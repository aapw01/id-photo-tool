'use client'

/**
 * The Studio workspace shell.
 *
 * Composition (top → bottom, left → right):
 *
 *   - Empty state: dropzone + helper copy
 *   - Loaded state:
 *       Top row     — top-bar tabs (background | size | layout | export)
 *       Left card   — the preview canvas, possibly wrapped in the
 *                     before/after slider when comparison is on
 *       Right card  — file/stats summary, retry, replace
 *       Right card  — tab-specific panel (BackgroundPanel or
 *                     ExportPanel; size/layout panels are M4/M6)
 *       Footer      — SegmentationFeedback (progress strip + toasts)
 *
 * The store automatically kicks off segmentation when a bitmap is
 * staged without a mask; subsequent runs are explicit (Retry).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { UploadDropzone } from '@/components/upload-dropzone'
import { Button } from '@/components/ui/button'
import { BackgroundPanel } from '@/features/background/background-panel'
import { ExportPanel } from '@/features/background/export-panel'
import { useBackgroundStore } from '@/features/background/store'
import { ComplianceBanner } from '@/features/crop/compliance-banner'
import { CropFrameOverlay } from '@/features/crop/crop-frame'
import { Guidelines } from '@/features/crop/guidelines'
import { SpecPicker } from '@/features/crop/spec-picker'
import { useCropStore } from '@/features/crop/spec-store'
import { useCropFlow } from '@/features/crop/use-crop-flow'
import { LayoutPanel, LayoutPreview } from '@/features/layout'
import { SegmentationFeedback } from '@/features/segmentation/segmentation-feedback'
import { useSegmentation } from '@/features/segmentation/use-segmentation'
import { useSpecManagerStore } from '@/features/spec-manager/store'

import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

import { useStudioStore } from './store'
import { StudioBottomTabs } from './studio-bottom-tabs'
import { StudioPreview } from './studio-preview'
import { StudioTabs } from './studio-tabs'
import { useStudioTabStore } from './studio-tab-store'
import { useTabDeeplink } from './tab-deeplink'

export function StudioWorkspace() {
  const t = useTranslations('Studio')
  const tActions = useTranslations('Studio.actions')
  const tTabs = useTranslations('Studio.tabs')
  const tMobile = useTranslations('Studio.mobile')

  const file = useStudioStore((s) => s.file)
  const bitmap = useStudioStore((s) => s.bitmap)
  const previewBitmap = useStudioStore((s) => s.previewBitmap)
  const mask = useStudioStore((s) => s.mask)
  const foreground = useStudioStore((s) => s.foreground)
  const setMask = useStudioStore((s) => s.setMask)
  const setFile = useStudioStore((s) => s.setFile)

  const bg = useBackgroundStore((s) => s.current)
  const tab = useStudioTabStore((s) => s.tab)

  // Crop tab state — driven by useCropFlow below.
  const cropSpec = useCropStore((s) => s.spec)
  const cropFrame = useCropStore((s) => s.frame)
  const showGuidelines = useCropStore((s) => s.showGuidelines)
  const setCropFrame = useCropStore((s) => s.setFrame)
  const resetCropForNewPhoto = useCropStore((s) => s.resetForNewPhoto)

  useCropFlow(bitmap, tab === 'size')
  useTabDeeplink()

  // Rehydrate the user's saved custom specs once on mount. The studio
  // reads merged (builtin + user) lists through `useEffective*Specs`,
  // and SSR starts with no customs — the microtask defer matches the
  // pattern in `spec-manager-shell.tsx` so React 19 doesn't flag the
  // setState as happening inside the synchronous effect body.
  const rehydrateSpecs = useSpecManagerStore((s) => s.rehydrate)
  const specsHydrated = useSpecManagerStore((s) => s.hydrated)
  useEffect(() => {
    if (specsHydrated) return
    let cancelled = false
    void (async () => {
      await null
      if (cancelled) return
      rehydrateSpecs()
    })()
    return () => {
      cancelled = true
    }
  }, [specsHydrated, rehydrateSpecs])

  const { segment, state, error } = useSegmentation()

  const [showCompare, setShowCompare] = useState(false)

  // Flash the before / after slider for a moment once segmentation
  // finishes so the user can immediately see what changed without
  // having to discover the compare toggle. We key off `mask` identity:
  // a brand-new ImageData reference means "fresh cut-out, show off the
  // result". The setTimeout dance is deliberate — the show happens on
  // the next tick (not during render commit) and the hide happens 3s
  // later; both are properly cleaned up on subsequent mask changes.
  useEffect(() => {
    if (!mask) return
    const showTimer = setTimeout(() => setShowCompare(true), 0)
    const hideTimer = setTimeout(() => setShowCompare(false), 3000)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [mask])
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  // Anchor for the main preview pane. On mobile we scroll back to it
  // whenever the side sheet closes — without this the page sticks
  // somewhere mid-document and users assume "nothing happened".
  const previewAnchorRef = useRef<HTMLDivElement>(null)

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setMobileSheetOpen(open)
    if (open) return
    // Defer to the next frame so the sheet exit animation can finish
    // unblocking the layout before we scroll. Behaviour: smooth so the
    // user perceives the preview "rising" rather than a hard jump.
    requestAnimationFrame(() => {
      previewAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  // The compare slider only makes sense on the background tab. Tabs are
  // navigable in any order, so users routinely toggle compare on, jump
  // to "size", and never return — the before/after wipe lingering over
  // the crop frame was visually confusing. Gate the preview on the
  // active tab so leaving "background" instantly hides the slider; we
  // keep the underlying state so flipping back picks up where the user
  // left off.
  const compareActive = tab === 'background' && showCompare

  const openMobileSheet = useCallback(() => {
    setMobileSheetOpen(true)
  }, [])

  const runSegmentation = useCallback(async () => {
    const currentFile = useStudioStore.getState().file
    if (!currentFile) return
    try {
      // ImageBitmap is transferable and gets detached on postMessage,
      // so always hand the worker a freshly decoded copy. The studio
      // store's bitmap stays alive for preview.
      const fresh = await createImageBitmap(currentFile, { imageOrientation: 'from-image' })
      // Ask the worker to also produce the decontaminated foreground so
      // the export pipeline can skip ~200-400 ms of alpha-matte + spill
      // suppression on the main thread (M5 P2-2).
      const result = await segment(fresh, { withForeground: true })
      setMask(result.mask, result)
    } catch {
      // SegmentationFeedback handles surfacing the error via toast.
    }
  }, [segment, setMask])

  // Background removal is intentionally opt-in. Users who only need
  // to crop or arrange a print layout should not pay the model
  // download + inference cost. The BackgroundPanel exposes a
  // "Start cut-out" CTA when the user actually wants to change the
  // background colour.

  const onReplaceClick = useCallback(() => {
    replaceInputRef.current?.click()
  }, [])

  const onReplacementFiles = useCallback(
    (files: FileList | null) => {
      const nextFile = files?.[0]
      if (!nextFile) return

      void (async () => {
        await setFile(nextFile)
        // Reset only what's bound to the underlying photo. The user's
        // size choice (e.g. "US visa"), paper / layout / background
        // colour are part of their *task* and survive a photo swap so
        // they don't have to re-pick everything for every retake.
        resetCropForNewPhoto()
        setShowCompare(false)
      })()
    },
    [resetCropForNewPhoto, setFile],
  )

  if (!bitmap) {
    return (
      <div className="space-y-4">
        <UploadDropzone />
        <p className="text-center text-sm text-[var(--color-text-weak)]">{t('empty.subtitle')}</p>
        <SegmentationFeedback />
      </div>
    )
  }

  // Show the crop overlay on Size (interactive) and Export (read-only).
  // The read-only variant gives users a visual reminder that their
  // chosen crop is still applied — without it, landing on Export shows
  // the whole original bitmap and users mistake that for "the crop got
  // reset". Comparing modes still hide the overlay so the slider UI
  // remains readable.
  const cropOverlay =
    (tab === 'size' || tab === 'export') && cropSpec && cropFrame ? (
      <>
        <CropFrameOverlay
          imageW={bitmap.width}
          imageH={bitmap.height}
          spec={cropSpec}
          frame={cropFrame}
          onChange={setCropFrame}
          readOnly={tab === 'export'}
        />
        {showGuidelines && tab === 'size' ? (
          <Guidelines
            imageW={bitmap.width}
            imageH={bitmap.height}
            spec={cropSpec}
            frame={cropFrame}
          />
        ) : null}
      </>
    ) : null

  const sidePanel = (
    <>
      {tab === 'background' ? (
        <BackgroundPanel
          hasMask={!!mask}
          segmentationState={state}
          onStartSegmentation={() => void runSegmentation()}
          showCompare={showCompare}
          onToggleCompare={setShowCompare}
        />
      ) : null}
      {tab === 'size' ? <SpecPicker /> : null}
      {tab === 'layout' ? (
        <LayoutPanel
          bitmap={bitmap}
          mask={mask}
          bg={bg}
          activeCropSpec={cropSpec ?? null}
          activeCropFrame={cropFrame ?? null}
        />
      ) : null}
      {tab === 'export' ? (
        <ExportPanel
          bitmap={bitmap}
          mask={mask}
          foreground={foreground}
          bg={bg}
          disabled={!!error}
          spec={cropSpec}
          frame={cropFrame}
        />
      ) : null}
    </>
  )

  const fileInfo = (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--color-text)]">{file?.name ?? 'image'}</p>
        <p className="font-mono text-xs text-[var(--color-text-mute)]">
          {t('stats.size', { w: bitmap.width, h: bitmap.height })}
        </p>
      </div>
      <div className="mt-3">
        <Button
          onClick={onReplaceClick}
          variant="outline"
          size="sm"
          className="w-full"
          style={{ touchAction: 'manipulation' }}
        >
          {tActions('replace')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => {
          onReplacementFiles(e.target.files)
          e.currentTarget.value = ''
        }}
      />

      <div className="hidden md:block">
        <StudioTabs />
      </div>

      {tab === 'size' || tab === 'export' ? <ComplianceBanner /> : null}

      <div ref={previewAnchorRef} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {tab === 'layout' ? (
          <LayoutPreview
            bitmap={bitmap}
            mask={mask}
            bg={bg}
            activeCropSpec={cropSpec ?? null}
            activeCropFrame={cropFrame ?? null}
          />
        ) : (
          <StudioPreview
            // Preview uses the downscaled bitmap so drags / tab swaps
            // don't redraw 20MP every frame. ExportPanel & LayoutPanel
            // still get the full-res bitmap for final quality output.
            bitmap={previewBitmap ?? bitmap}
            mask={mask}
            foreground={foreground}
            bg={bg}
            showCompare={compareActive}
            overlay={cropOverlay}
          />
        )}

        <aside className="hidden space-y-4 md:block">
          {fileInfo}
          {sidePanel}
        </aside>

        <div className="space-y-4 md:hidden">{fileInfo}</div>
      </div>

      <SegmentationFeedback />

      <StudioBottomTabs onSelect={openMobileSheet} />

      <Sheet open={mobileSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{tTabs(tab)}</SheetTitle>
            <p className="text-sm text-[var(--color-text-mute)]">{tMobile('panelSummary')}</p>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-4">{sidePanel}</div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}

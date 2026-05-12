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
import { SegmentationFeedback } from '@/features/segmentation/segmentation-feedback'
import { useSegmentation } from '@/features/segmentation/use-segmentation'

import { useStudioStore } from './store'
import { StudioPreview } from './studio-preview'
import { StudioTabs } from './studio-tabs'
import { useStudioTabStore } from './studio-tab-store'

export function StudioWorkspace() {
  const t = useTranslations('Studio')
  const tActions = useTranslations('Studio.actions')

  const file = useStudioStore((s) => s.file)
  const bitmap = useStudioStore((s) => s.bitmap)
  const mask = useStudioStore((s) => s.mask)
  const lastInference = useStudioStore((s) => s.lastInference)
  const setMask = useStudioStore((s) => s.setMask)
  const setFile = useStudioStore((s) => s.setFile)

  const bg = useBackgroundStore((s) => s.current)
  const tab = useStudioTabStore((s) => s.tab)

  // Crop tab state — driven by useCropFlow below.
  const cropSpec = useCropStore((s) => s.spec)
  const cropFrame = useCropStore((s) => s.frame)
  const showGuidelines = useCropStore((s) => s.showGuidelines)
  const setCropFrame = useCropStore((s) => s.setFrame)

  useCropFlow(bitmap, tab === 'size')

  const { segment, state, error } = useSegmentation()

  const [showCompare, setShowCompare] = useState(false)

  const runSegmentation = useCallback(async () => {
    const currentFile = useStudioStore.getState().file
    if (!currentFile) return
    try {
      // ImageBitmap is transferable and gets detached on postMessage,
      // so always hand the worker a freshly decoded copy. The studio
      // store's bitmap stays alive for preview.
      const fresh = await createImageBitmap(currentFile, { imageOrientation: 'from-image' })
      const result = await segment(fresh)
      setMask(result.mask, result)
    } catch {
      // SegmentationFeedback handles surfacing the error via toast.
    }
  }, [segment, setMask])

  const lastRun = useRef<ImageBitmap | null>(null)
  useEffect(() => {
    if (!bitmap || mask) return
    if (lastRun.current === bitmap) return
    lastRun.current = bitmap
    void runSegmentation()
  }, [bitmap, mask, runSegmentation])

  const onReset = useCallback(() => {
    void setFile(null)
  }, [setFile])

  if (!bitmap) {
    return (
      <div className="space-y-4">
        <UploadDropzone />
        <p className="text-center text-sm text-[var(--color-text-weak)]">{t('empty.subtitle')}</p>
        <SegmentationFeedback />
      </div>
    )
  }

  // Only show the crop overlay when the size tab is open and we have
  // a spec + frame. Comparing modes hide the overlay so the slider UI
  // remains readable.
  const cropOverlay =
    tab === 'size' && cropSpec && cropFrame ? (
      <>
        <CropFrameOverlay
          imageW={bitmap.width}
          imageH={bitmap.height}
          spec={cropSpec}
          frame={cropFrame}
          onChange={setCropFrame}
        />
        {showGuidelines ? (
          <Guidelines
            imageW={bitmap.width}
            imageH={bitmap.height}
            spec={cropSpec}
            frame={cropFrame}
          />
        ) : null}
      </>
    ) : null

  return (
    <div className="space-y-4">
      <StudioTabs />

      {tab === 'size' ? <ComplianceBanner /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <StudioPreview
          bitmap={bitmap}
          mask={mask}
          bg={bg}
          showCompare={showCompare}
          overlay={cropOverlay}
        />

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {file?.name ?? 'image'}
              </p>
              <p className="font-mono text-xs text-[var(--color-text-mute)]">
                {t('stats.size', { w: bitmap.width, h: bitmap.height })}
              </p>
              {lastInference ? (
                <p className="font-mono text-xs text-[var(--color-text-mute)]">
                  {t('stats.inference', {
                    backend: lastInference.backend,
                    ms: lastInference.durationMs,
                  })}
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Button onClick={onReset} variant="outline" size="sm">
                {tActions('replace')}
              </Button>
              <Button
                onClick={() => void runSegmentation()}
                disabled={state === 'loading-model' || state === 'inferring'}
                variant="ghost"
                size="sm"
              >
                {tActions('retry')}
              </Button>
            </div>
          </div>

          {tab === 'background' ? (
            <BackgroundPanel showCompare={showCompare} onToggleCompare={setShowCompare} />
          ) : null}
          {tab === 'size' ? <SpecPicker /> : null}
          {tab === 'export' ? (
            <ExportPanel
              bitmap={bitmap}
              mask={mask}
              bg={bg}
              disabled={!!error}
              spec={cropSpec}
              frame={cropFrame}
            />
          ) : null}
        </aside>
      </div>

      <SegmentationFeedback />
    </div>
  )
}

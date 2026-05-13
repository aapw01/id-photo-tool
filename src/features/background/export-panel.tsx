'use client'

/**
 * Single-photo export panel — M5.
 *
 * Three groups of controls:
 *
 *   1. Format select — png-alpha / png-flat / jpg / webp. Names are
 *      i18n'd; the alpha variants are explained in `hint.*`.
 *   2. Quality slider — visible only for JPG / WebP, ranges 30–100 %
 *      with a 1 % step. The internal value is float quality 0..1.
 *   3. Compress-to-KB — toggle + numeric input. When on, the export
 *      pipeline runs `compressToKB` and feeds the resulting blob to
 *      the download button. When off, single-blob export runs.
 *
 * Most of the orchestration logic lives in focused hooks under
 * `./export-panel/*` so this file can stay narrowly focused on UI:
 *
 *   - `useExportForeground`     — cached preview foreground + one-shot
 *                                 full-res escape hatch.
 *   - `useExportTargetPixels`   — the 3-mode pixel-size resolver.
 *   - `useExportSizeEstimate`   — debounced two-format size estimator.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Download, Loader2, Smartphone, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildFilename,
  compressToKB,
  exportSingle,
  triggerDownload,
  type ExportFormat,
} from '@/features/export'
import { useStudioTabStore } from '@/features/studio/studio-tab-store'
import { useIsWeChat } from '@/lib/ua'
import { cn } from '@/lib/utils'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { scaleFrameForForeground, type BgColor } from './composite'
import { useExportForeground, PREVIEW_FG_LONGSIDE_PX } from './export-panel/use-export-foreground'
import { useExportSizeEstimate } from './export-panel/use-export-size-estimate'
import { useExportTargetPixels } from './export-panel/use-export-target-pixels'

interface ExportPanelProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  /**
   * Decontaminated foreground RGBA produced inside the segmentation
   * worker. When present, the preview cut-out skips the main-thread
   * alpha-matte + spill suppression passes (M5 P2-2).
   */
  foreground?: ImageData | null
  bg: BgColor
  disabled?: boolean
  spec?: PhotoSpec | null
  frame?: CropFrame | null
}

const FORMATS: ExportFormat[] = ['png-alpha', 'png-flat', 'jpg', 'webp']

export function ExportPanel({
  bitmap,
  mask,
  foreground: precomputedForeground,
  bg,
  disabled,
  spec,
  frame,
}: ExportPanelProps) {
  const t = useTranslations('Export')

  // png-alpha needs a real cut-out to mean anything. If the user
  // hasn't run segmentation yet, default to png-flat so the Download
  // button isn't silently disabled when they land on this tab.
  const [format, setFormat] = useState<ExportFormat>(() => (mask ? 'png-alpha' : 'png-flat'))
  const [quality, setQuality] = useState<number>(0.92)
  const [compress, setCompress] = useState<boolean>(false)
  // Escape hatch for users who picked a spec but want a high-
  // resolution download (e.g. "I selected 美国签证 but still want a
  // print-quality file"). When `true`, `targetPixels` ignores the
  // spec's prescribed pixel box and uses the crop frame's native
  // pixel dimensions instead — same aspect ratio, but a much larger
  // file because we skip the downscale to 600×600.
  const [keepNativeResolution, setKeepNativeResolution] = useState<boolean>(false)
  // Suggest the spec's maxKB when present, otherwise a sensible default.
  const [targetKB, setTargetKB] = useState<number>(() => spec?.fileRules?.maxKB ?? 100)
  // Tracks whether an export is in flight so the button reflects busy
  // status — large bitmaps can take a couple of seconds and a silent
  // click looks broken.
  const [downloading, setDownloading] = useState<boolean>(false)
  const [copying, setCopying] = useState<boolean>(false)

  const { foreground, acquireFullRes } = useExportForeground(bitmap, mask, precomputedForeground)

  // If the mask is dropped (user replaced their photo) while we're
  // sitting on png-alpha, downgrade to png-flat so the Download
  // button keeps working without the user noticing the silent block.
  useEffect(() => {
    if (mask) return
    if (format !== 'png-alpha') return
    let cancelled = false
    void (async () => {
      await null
      if (cancelled) return
      setFormat('png-flat')
    })()
    return () => {
      cancelled = true
    }
  }, [mask, format])

  // The actual byte source we hand to the export pipeline. When the
  // user hasn't cut out the subject yet we fall back to the original
  // bitmap so single-photo export still works for crop-only or
  // layout-only workflows. The `bg` colour is then ignored by the
  // pipeline because the original bitmap is opaque.
  const exportSource: ImageBitmap | null = foreground ?? bitmap

  // Refresh the default target KB when the spec changes. We only nudge
  // the value if the spec carries an explicit rule — otherwise users
  // who typed a custom number keep it. Use `await null` to defer the
  // setState past the synchronous effect body (React 19 rule).
  useEffect(() => {
    const maxKB = spec?.fileRules?.maxKB
    if (!maxKB) return
    let cancelled = false
    const apply = async () => {
      await null
      if (cancelled) return
      setTargetKB(maxKB)
    }
    void apply()
    return () => {
      cancelled = true
    }
  }, [spec?.fileRules?.maxKB])

  const targetPixels = useExportTargetPixels({ bitmap, spec, frame, keepNativeResolution })

  const estimates = useExportSizeEstimate({
    exportSource,
    foreground,
    bitmap,
    bg,
    targetPixels,
    frame,
    quality,
    format,
  })

  // Filename preview: layout/single/compressed swap based on toggle.
  const filename = useMemo(() => {
    const ext = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'
    if (compress && (format === 'jpg' || format === 'webp')) {
      return buildFilename({
        kind: 'compressed',
        spec: spec ?? null,
        ext,
        targetKB: Math.round(targetKB),
        width: targetPixels.width,
        height: targetPixels.height,
      })
    }
    return buildFilename({
      kind: 'single',
      spec: spec ?? null,
      ext,
      width: targetPixels.width,
      height: targetPixels.height,
    })
  }, [format, compress, targetKB, targetPixels, spec])

  const isAlpha = format === 'png-alpha' || format === 'webp'
  const supportsCompress = format === 'jpg' || format === 'webp'

  const onDownload = useCallback(async () => {
    if (!exportSource) return
    setDownloading(true)
    let oneShot: ImageBitmap | null = null
    try {
      const targetLong = Math.max(targetPixels.width, targetPixels.height)
      const acquired = await acquireFullRes(targetLong)
      oneShot = acquired.oneShot
      const source = acquired.source
      let blob: Blob
      if (compress && supportsCompress) {
        const result = await compressToKB({
          source,
          targetKB,
          format: format === 'jpg' ? 'jpg' : 'webp',
          initialWidth: targetPixels.width,
          initialHeight: targetPixels.height,
        })
        blob = result.blob
        if (!result.hit) {
          toast.warning(t('compressMiss', { kb: Math.round(result.finalKB) }))
        }
      } else {
        // `frame` is authored in original-bitmap pixel space. When the
        // foreground was capped to a smaller working resolution we have
        // to rescale the frame into the source's coord system before
        // handing it to the export pipeline.
        const sourceFrame = frame
          ? scaleFrameForForeground(
              frame,
              bitmap.width,
              bitmap.height,
              (source as { width: number }).width,
              (source as { height: number }).height,
            )
          : null
        const result = await exportSingle({
          foreground: source,
          bg,
          format,
          targetPixels,
          frame: sourceFrame,
          quality: supportsCompress ? quality : undefined,
        })
        blob = result.blob
      }

      triggerDownload(blob, filename)
      toast.success(t('downloadSuccess', { filename }))
    } catch {
      toast.error(t('downloadFailed'))
    } finally {
      oneShot?.close?.()
      setDownloading(false)
    }
  }, [
    exportSource,
    acquireFullRes,
    bitmap,
    compress,
    supportsCompress,
    targetKB,
    format,
    targetPixels,
    bg,
    frame,
    quality,
    filename,
    t,
  ])

  const onCopy = useCallback(async () => {
    if (!exportSource) return
    setCopying(true)
    let oneShot: ImageBitmap | null = null
    try {
      const targetLong = Math.max(targetPixels.width, targetPixels.height)
      const acquired = await acquireFullRes(targetLong)
      oneShot = acquired.oneShot
      const source = acquired.source
      const sourceFrame = frame
        ? scaleFrameForForeground(
            frame,
            bitmap.width,
            bitmap.height,
            (source as { width: number }).width,
            (source as { height: number }).height,
          )
        : null
      const result = await exportSingle({
        foreground: source,
        bg,
        // Without a mask we can't deliver a real transparent PNG.
        // Fall back to png-flat so the clipboard image still matches
        // what's on screen.
        format: foreground ? 'png-alpha' : 'png-flat',
        targetPixels,
        frame: sourceFrame,
      })
      const item = new ClipboardItem({ 'image/png': result.blob })
      await navigator.clipboard.write([item])
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    } finally {
      oneShot?.close?.()
      setCopying(false)
    }
  }, [exportSource, acquireFullRes, bitmap, foreground, bg, targetPixels, frame, t])

  // png-alpha only makes sense with a real cut-out; everything else
  // works with either the cut-out or the raw bitmap.
  const formatNeedsMask = format === 'png-alpha'
  const busy = downloading || copying
  const blocked = disabled || !exportSource || (formatNeedsMask && !foreground) || busy

  // Show a "preserves original resolution" notice when the export
  // target exceeds the cached preview foreground. The download path
  // builds a fresh full-res cut-out on the fly which can take a
  // couple of seconds — surfacing the cause stops users from thinking
  // the button is broken.
  const targetLong = Math.max(targetPixels.width, targetPixels.height)
  const showFullResHint = targetLong > PREVIEW_FG_LONGSIDE_PX

  const exportFollowsSpec = !!(spec && frame)
  const qualityPercent = Math.round(quality * 100)
  const isQualityMax = qualityPercent === 100
  const estimateBytes = estimates[format]

  // Show the original bitmap dimensions alongside the export target so
  // the user sees "why is my export smaller than my upload" at a
  // glance: the spec, not the encoder, did most of the shrinking.
  const sourceLong = Math.max(bitmap.width, bitmap.height)
  const targetLongPx = Math.max(targetPixels.width, targetPixels.height)
  const shrinkRatio = sourceLong / Math.max(1, targetLongPx)
  // Only surface the ratio when it's meaningful — a tiny crop ≈ source
  // resolution shouldn't say "缩放 1×".
  const showShrinkRatio = exportFollowsSpec && shrinkRatio >= 1.5

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      {!exportFollowsSpec ? (
        // Default fallback path — exporting the raw bitmap with no spec
        // applied. Most users land here unintentionally (they skipped
        // the size tab). Make the fallback explicit and give them a
        // one-tap way to fix it before they download a non-compliant
        // file.
        <div className="space-y-2 rounded-md border border-[var(--color-warning,#f59e0b)] bg-[var(--color-warning-soft,#fef3c7)] p-3">
          <p className="text-sm font-medium text-[var(--color-warning-text,#92400e)]">
            {t('noSpec.title')}
          </p>
          <p className="text-xs text-[var(--color-warning-text,#92400e)]">{t('noSpec.body')}</p>
          <button
            type="button"
            onClick={() => useStudioTabStore.getState().setTab('size')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
            style={{ touchAction: 'manipulation' }}
          >
            {t('noSpec.cta')}
          </button>
        </div>
      ) : null}

      <div className="space-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] px-3 py-2">
        <p className="font-mono text-xs text-[var(--color-text)]">
          {exportFollowsSpec
            ? t('dimensionsCompared', {
                sw: bitmap.width,
                sh: bitmap.height,
                tw: targetPixels.width,
                th: targetPixels.height,
              })
            : t('dimensionsByBitmap', { w: targetPixels.width, h: targetPixels.height })}
        </p>
        {exportFollowsSpec ? (
          <p className="text-xs text-[var(--color-text-mute)]">
            {keepNativeResolution
              ? t('dimensionsModeNative')
              : showShrinkRatio
                ? t('dimensionsModeSpecWithRatio', { ratio: shrinkRatio.toFixed(1) })
                : t('dimensionsModeSpec')}
          </p>
        ) : null}
      </div>

      {exportFollowsSpec ? (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <input
            id="keep-native-toggle"
            type="checkbox"
            checked={keepNativeResolution}
            onChange={(e) => setKeepNativeResolution(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
          />
          <Label
            htmlFor="keep-native-toggle"
            className="flex flex-col gap-0.5 text-xs leading-snug"
          >
            <span className="font-medium text-[var(--color-text)]">{t('keepNativeLabel')}</span>
            <span className="text-[var(--color-text-mute)]">{t('keepNativeHint')}</span>
          </Label>
        </div>
      ) : null}

      {exportFollowsSpec ? (
        <p className="text-xs text-[var(--color-text-mute)]">{t('cropAppliedHint')}</p>
      ) : null}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-[var(--color-text)]">{t('format.label')}</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('format.label')}>
          {FORMATS.map((f) => {
            const active = format === f
            const kb = estimates[f]
            const requiresMask = f === 'png-alpha'
            const optionDisabled = requiresMask && !foreground
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={optionDisabled}
                disabled={optionDisabled}
                onClick={() => !optionDisabled && setFormat(f)}
                title={optionDisabled ? t('alphaNeedsCutout') : undefined}
                className={cn(
                  'flex h-auto flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
                  optionDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <span className="text-sm text-[var(--color-text)]">
                  {t(`format.${f}` as 'format.png-alpha')}
                </span>
                <span className="font-mono text-xs text-[var(--color-text-mute)]">
                  {kb !== null ? t('size', { kb: Math.round(kb / 1024) }) : '—'}
                </span>
              </button>
            )
          })}
        </div>
        {!foreground ? (
          <button
            type="button"
            onClick={() => useStudioTabStore.getState().setTab('background')}
            className={cn(
              'flex w-full items-start gap-2 rounded-md border border-dashed border-[var(--color-border)]',
              'bg-[var(--color-divider)] px-3 py-2 text-left transition-colors',
              'hover:bg-[var(--color-primary-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
            )}
          >
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-dk)]"
              aria-hidden
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--color-text)]">{t('alphaCutoutHint')}</span>
              <span className="text-xs font-medium text-[var(--color-primary-dk)]">
                {t('alphaGoToBackground')}
              </span>
            </span>
          </button>
        ) : null}
        <p className="text-xs text-[var(--color-text-mute)]">
          {t(isAlpha ? 'hint.alpha' : 'hint.flat')}
        </p>
      </div>

      {supportsCompress ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="quality-slider"
              className="text-xs font-medium text-[var(--color-text)]"
            >
              {t('quality')}
            </Label>
            <span className="font-mono text-xs text-[var(--color-text-mute)]">
              {isQualityMax ? `${qualityPercent}% · ${t('qualityMax')}` : `${qualityPercent}%`}
            </span>
          </div>
          <input
            id="quality-slider"
            type="range"
            min={30}
            max={100}
            step={1}
            value={qualityPercent}
            onChange={(e) => setQuality(Number(e.target.value) / 100)}
            disabled={compress}
            className="w-full accent-[var(--color-primary)] disabled:opacity-50"
          />
          <p className="font-mono text-xs text-[var(--color-text-mute)]">
            {estimateBytes !== null
              ? t('estimateLabelDetailed', {
                  kb: Math.round(estimateBytes / 1024),
                  w: targetPixels.width,
                  h: targetPixels.height,
                })
              : '—'}
          </p>
          {compress ? (
            <p className="text-xs text-[var(--color-text-mute)]">{t('qualityLockedByCompress')}</p>
          ) : isQualityMax ? (
            <p className="text-xs text-[var(--color-text-mute)]">{t('qualityMaxHint')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] p-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="compress-toggle" className="text-xs font-medium text-[var(--color-text)]">
            {t('compressToKB')}
          </Label>
          <input
            id="compress-toggle"
            type="checkbox"
            checked={compress}
            disabled={!supportsCompress}
            onChange={(e) => setCompress(e.target.checked)}
            className="size-4 accent-[var(--color-primary)] disabled:opacity-50"
          />
        </div>
        {supportsCompress ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={targetKB}
                onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value) || 1))}
                disabled={!compress}
                className="h-8 w-24 font-mono text-xs"
              />
              <span className="text-xs text-[var(--color-text-mute)]">KB</span>
            </div>
            <p className="text-xs text-[var(--color-text-mute)]">{t('kbHint')}</p>
          </>
        ) : (
          <p className="text-xs text-[var(--color-text-mute)]">{t('compressUnsupported')}</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-mute)]">{t('filenamePreview')}</p>
        <p className="rounded-md bg-[var(--color-divider)] px-2 py-1 font-mono text-xs break-all text-[var(--color-text)]">
          {filename}
        </p>
        {showFullResHint ? (
          <p className="text-xs text-[var(--color-text-mute)]">{t('fullResHint')}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void onDownload()}
          disabled={blocked}
          style={{ touchAction: 'manipulation' }}
          aria-busy={downloading}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {downloading ? t('actions.downloading') : t('actions.download')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void onCopy()}
          disabled={blocked}
          style={{ touchAction: 'manipulation' }}
          aria-busy={copying}
        >
          {copying ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copying ? t('actions.copying') : t('actions.copy')}
        </Button>
      </div>

      <WeChatSaveHint />
    </section>
  )
}

function WeChatSaveHint() {
  const tExport = useTranslations('Export')
  const isWx = useIsWeChat()
  if (!isWx) return null
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-3 text-xs leading-relaxed text-[var(--color-text)]"
    >
      <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-dk)]" aria-hidden />
      <span>{tExport('wechatHint')}</span>
    </div>
  )
}

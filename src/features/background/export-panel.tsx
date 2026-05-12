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
 * The panel reads `spec` + `frame` from the parent (Studio passes
 * them through) and shows a filename preview using `buildFilename`.
 * Size estimates per format render in the small badge next to each
 * format option, refreshed whenever the foreground or settings
 * change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Download, Loader2, Smartphone, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildFilename, compressToKB, exportSingle, type ExportFormat } from '@/features/export'
import { useStudioTabStore } from '@/features/studio/studio-tab-store'
import { derivePixels } from '@/lib/spec-units'
import { useIsWeChat } from '@/lib/ua'
import { cn } from '@/lib/utils'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { extractForegroundCapped, scaleFrameForForeground, type BgColor } from './composite'

interface ExportPanelProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  disabled?: boolean
  spec?: PhotoSpec | null
  frame?: CropFrame | null
}

const FORMATS: ExportFormat[] = ['png-alpha', 'png-flat', 'jpg', 'webp']

/** Long-side cap (in pixels) for the size-estimate preview canvas. */
const ESTIMATE_LONGSIDE_PX = 1280
/** Tail-debounce window for the file-size estimate effect. */
const ESTIMATE_DEBOUNCE_MS = 400
/**
 * Long-side cap of the cached preview foreground. Has to match the
 * default used by `extractForegroundCapped` so the "do I need to
 * rebuild?" check in `onDownload` / `onCopy` agrees with what the
 * preview effect actually stashes.
 */
const PREVIEW_FG_LONGSIDE_PX = 1600

/**
 * Render `src` into a `previewW × previewH` canvas, applying `frame`
 * (in original-bitmap pixel space) up front. When `src` has been
 * capped to a working resolution by `extractForegroundCapped`, we
 * rescale `frame` to the source's coord system before drawing. The
 * resulting canvas is already the size the estimate pipeline wants
 * out the other end, so `exportSingle`'s fast path can skip
 * resampling entirely.
 */
function buildEstimateSource(
  src: ImageBitmap | HTMLCanvasElement,
  frame: CropFrame | null | undefined,
  previewW: number,
  previewH: number,
  bitmapW: number,
  bitmapH: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(previewW))
  c.height = Math.max(1, Math.round(previewH))
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const srcW = (src as { width: number }).width
  const srcH = (src as { height: number }).height
  if (frame) {
    const scaled = scaleFrameForForeground(frame, bitmapW, bitmapH, srcW, srcH)
    ctx.drawImage(
      src as CanvasImageSource,
      scaled.x,
      scaled.y,
      scaled.w,
      scaled.h,
      0,
      0,
      c.width,
      c.height,
    )
  } else {
    ctx.drawImage(src as CanvasImageSource, 0, 0, srcW, srcH, 0, 0, c.width, c.height)
  }
  return c
}

export function ExportPanel({ bitmap, mask, bg, disabled, spec, frame }: ExportPanelProps) {
  const t = useTranslations('Export')

  const [foreground, setForeground] = useState<ImageBitmap | null>(null)
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
  const [estimates, setEstimates] = useState<Record<ExportFormat, number | null>>({
    'png-alpha': null,
    'png-flat': null,
    jpg: null,
    webp: null,
  })
  // Tracks whether an export is in flight so the button reflects busy
  // status — large bitmaps can take a couple of seconds and a silent
  // click looks broken.
  const [downloading, setDownloading] = useState<boolean>(false)
  const [copying, setCopying] = useState<boolean>(false)
  // Set of in-flight object URLs we have to revoke later. Revoking
  // immediately after `.click()` races the browser's download fetch on
  // Safari; we wait 30s then clean up. The ref also lets the unmount
  // effect tidy any URLs that outlived the component.
  const pendingUrls = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      if (!mask) {
        // No cut-out yet — `exportSource` falls back to the raw bitmap.
        setForeground((prev) => {
          prev?.close?.()
          return null
        })
        return
      }
      const fg = await extractForegroundCapped(bitmap, mask)
      if (cancelled) {
        fg.close?.()
        return
      }
      setForeground((prev) => {
        prev?.close?.()
        return fg
      })
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [bitmap, mask])

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

  // The target pixel size resolves in three modes:
  //   1. spec + frame, default behaviour      → spec's prescribed pixel box
  //      (e.g. 美国签证 → 602 × 602 @ 300 DPI). The spec wins because the
  //      printed photo has to land at the right physical size.
  //   2. spec + frame, `keepNativeResolution` → the frame's native pixel
  //      dimensions in the original-bitmap coord system. Same aspect as
  //      the spec, but a higher-resolution file (typical 1500–2500 px
  //      long side on a modern phone shot). Use when the user wants a
  //      large file at the spec ratio.
  //   3. neither spec nor frame              → the original bitmap size,
  //      i.e. "raw export" (no crop, no resize).
  const targetPixels = useMemo(() => {
    if (spec && frame) {
      if (keepNativeResolution) {
        return { width: Math.round(frame.w), height: Math.round(frame.h) }
      }
      const r = derivePixels(spec)
      return { width: r.width_px, height: r.height_px }
    }
    return { width: bitmap.width, height: bitmap.height }
  }, [spec, frame, bitmap, keepNativeResolution])

  // Estimate file sizes for the *currently selected* format only (plus
  // its alpha cousin when a cut-out is available). Estimating all four
  // formats simultaneously — as we used to — runs four full encode
  // passes on every quality-slider tick / mask change, which on a 20MP
  // photo starves the click handler that triggers the actual download.
  //
  // The estimate is a hint, not an exact byte count, so we run it
  // against a single downscaled preview canvas (long side ≤ 1280px) that
  // we draw ONCE per debounce tick. `exportSingle` then takes its fast
  // path (no frame, target === source dims) and the encode never has to
  // traverse a 20MP intermediate just to read back the blob size.
  //
  // Tail-debounced by 400ms so dragging the quality slider doesn't
  // hammer the encoder on every tick.
  useEffect(() => {
    let cancelled = false
    if (!exportSource) {
      // React 19: defer the setState past the synchronous effect body.
      void (async () => {
        await null
        if (cancelled) return
        setEstimates({ 'png-alpha': null, 'png-flat': null, jpg: null, webp: null })
      })()
      return () => {
        cancelled = true
      }
    }

    const handle = setTimeout(() => {
      void (async () => {
        if (cancelled) return

        // Pick the at-most-two formats we'll estimate this pass.
        const wanted: ExportFormat[] = [format]
        if (foreground) {
          if (format === 'png-flat') wanted.push('png-alpha')
          else if (format === 'png-alpha') wanted.push('png-flat')
        }

        const longest = Math.max(targetPixels.width, targetPixels.height)
        const scale = longest > ESTIMATE_LONGSIDE_PX ? ESTIMATE_LONGSIDE_PX / longest : 1
        const previewW = Math.max(1, Math.round(targetPixels.width * scale))
        const previewH = Math.max(1, Math.round(targetPixels.height * scale))

        // Build the downscaled estimate source once and reuse across
        // every format we sample this tick. The frame is baked into
        // this canvas in image-pixel space — so `exportSingle` gets a
        // canvas that already matches `targetPixels` and the fast path
        // (no resample) fires for every format below.
        const estimateSource = buildEstimateSource(
          exportSource,
          frame,
          previewW,
          previewH,
          bitmap.width,
          bitmap.height,
        )
        // Reported bytes ≈ measured bytes × (target_area / preview_area).
        const sizeMultiplier = scale === 1 ? 1 : 1 / (scale * scale)

        const next: Record<ExportFormat, number | null> = {
          'png-alpha': null,
          'png-flat': null,
          jpg: null,
          webp: null,
        }
        for (const f of wanted) {
          if (f === 'png-alpha' && !foreground) {
            next[f] = null
            continue
          }
          try {
            const result = await exportSingle({
              foreground: estimateSource,
              bg,
              format: f,
              targetPixels: { width: previewW, height: previewH },
              frame: null,
              quality: f === 'jpg' || f === 'webp' ? quality : undefined,
            })
            if (cancelled) return
            next[f] = Math.round(result.blob.size * sizeMultiplier)
          } catch {
            next[f] = null
          }
        }
        if (cancelled) return
        setEstimates(next)
      })()
    }, ESTIMATE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [exportSource, foreground, bitmap, bg, targetPixels, frame, quality, format])

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

  // Build the foreground actually used for an export. The cached
  // preview foreground is intentionally capped at
  // `PREVIEW_FG_LONGSIDE_PX` so the editor stays snappy on 20 MP
  // photos — but feeding that small bitmap into a full-res download
  // (e.g. target 3648×5472 or a >1600 spec) upscales it and the
  // result looks blurry. When the target exceeds the cache, build a
  // one-shot foreground sized for *this* export only. The caller is
  // responsible for closing the one-shot bitmap once the export is
  // done; the cached preview foreground is never touched.
  const acquireExportForeground = useCallback(async (): Promise<{
    source: ImageBitmap
    oneShot: ImageBitmap | null
  }> => {
    const targetLong = Math.max(targetPixels.width, targetPixels.height)
    const cachedLong = foreground ? Math.max(foreground.width, foreground.height) : 0
    const needsFullRes = !!mask && targetLong > cachedLong
    if (!needsFullRes) {
      return { source: foreground ?? bitmap, oneShot: null }
    }
    // Add a small headroom so the resampler downscales (sharp) rather
    // than upscales (blurry) — matches `derivePixels` rounding slop.
    const oneShot = await extractForegroundCapped(bitmap, mask!, {
      maxLongSide: Math.max(PREVIEW_FG_LONGSIDE_PX, Math.ceil(targetLong * 1.05)),
    })
    return { source: oneShot, oneShot }
  }, [bitmap, mask, foreground, targetPixels])

  const onDownload = useCallback(async () => {
    if (!exportSource) return
    setDownloading(true)
    let oneShot: ImageBitmap | null = null
    try {
      const acquired = await acquireExportForeground()
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

      const url = URL.createObjectURL(blob)
      pendingUrls.current.add(url)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Safari can race the revoke against the download fetch when we
      // revoke synchronously after click. Wait long enough for any
      // browser to have started its download stream.
      setTimeout(() => {
        URL.revokeObjectURL(url)
        pendingUrls.current.delete(url)
      }, 30_000)
    } catch {
      toast.error(t('downloadFailed'))
    } finally {
      oneShot?.close?.()
      setDownloading(false)
    }
  }, [
    exportSource,
    acquireExportForeground,
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
      const acquired = await acquireExportForeground()
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
  }, [exportSource, acquireExportForeground, bitmap, foreground, bg, targetPixels, frame, t])

  // Tidy any object URLs that are still hanging around at unmount —
  // the 30s deferred-revoke timer might still be pending.
  useEffect(() => {
    const urls = pendingUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

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

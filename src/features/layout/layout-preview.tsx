'use client'

/**
 * Layout preview canvas.
 *
 * Builds a cropped foreground per unique PhotoSpec in the current
 * template and feeds them into `renderLayout`. Wraps the resulting
 * canvas in a card so it scales nicely inside the main pane.
 *
 * Per-spec crop strategy:
 *
 *   - When the spec matches the user's currently chosen size-tab spec
 *     *and* a CropFrame is present, we reuse the precise crop the user
 *     locked in (so head placement is identical).
 *   - Otherwise we fall back to `centerCrop` on the foreground bitmap
 *     so mixed-layout cells still get a sensible image rather than a
 *     placeholder.
 *
 * Rendering happens off-screen via `renderLayout` (HTMLCanvasElement)
 * then we copy the bytes onto an in-flow canvas so React can manage
 * the DOM. The off-screen step keeps the render pipeline test-able
 * (see `render-layout.test.ts`).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { centerCrop } from '@/features/crop/auto-center'
import { extractForeground, type BgColor } from '@/features/background/composite'
import { exportSingle } from '@/features/export'
import { derivePixels, aspectRatio } from '@/lib/spec-units'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { renderLayout, type RenderLayoutResult } from './render-layout'
import { useLayoutStore } from './store'

// Cap the preview canvas at 800 CSS pixels on its longest side so
// huge papers (A4 at 300 DPI) don't blow the layout. Crop output stays
// at the spec's native pixel count — the visual scaling happens via
// CSS, not pixel resampling.
const PREVIEW_MAX_CSS_PX = 800
const PREVIEW_DPI = 150

/**
 * Pick the right source + background pair for the per-cell export.
 *
 * Before the mask arrives we tile the *original* bitmap with the
 * background pinned to transparent; once segmentation lands we switch
 * to the cut-out foreground composed onto the user's chosen colour.
 * Extracted so the contract is easy to unit-test (see
 * `layout-preview.test.ts`).
 */
export function pickCellSource(
  bitmap: ImageBitmap,
  foreground: ImageBitmap | null,
  bg: BgColor,
): {
  source: ImageBitmap
  bg: BgColor
  format: 'png-flat' | 'png-alpha'
} {
  if (foreground) {
    return { source: foreground, bg, format: 'png-flat' }
  }
  return { source: bitmap, bg: { kind: 'transparent' }, format: 'png-alpha' }
}

interface LayoutPreviewProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  /** The size-tab's currently picked spec (may be null on a fresh load). */
  activeCropSpec: PhotoSpec | null
  /** The size-tab's locked crop frame for `activeCropSpec`. */
  activeCropFrame: CropFrame | null
  onRendered?: (result: RenderLayoutResult) => void
}

export function LayoutPreview({
  bitmap,
  mask,
  bg,
  activeCropSpec,
  activeCropFrame,
  onRendered,
}: LayoutPreviewProps) {
  const t = useTranslations('Layout.preview')
  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const settings = useLayoutStore((s) => s.settings)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [overflow, setOverflow] = useState<RenderLayoutResult['overflow']>([])
  const [busy, setBusy] = useState<boolean>(false)
  const [cellImages, setCellImages] = useState<Map<string, HTMLCanvasElement>>(new Map())

  // 1. Prepare a per-spec cell image whenever the cropped foreground
  // or active spec changes. Keyed by photoSpecId so the renderer can
  // look them up cheaply.
  //
  // When `mask` hasn't arrived yet (segmentation is still warming up
  // or failed) we fall back to the raw bitmap — the user sees their
  // actual photo tiled across the paper instead of grey placeholders.
  // The previous behaviour painted nothing until segmentation finished;
  // that was indistinguishable from a broken render when the WebGPU
  // backend stalled or the model fetch was slow.
  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return

      const foreground: ImageBitmap | null = mask ? await extractForeground(bitmap, mask) : null
      if (cancelled) {
        foreground?.close?.()
        return
      }
      const { source, bg: effectiveBg, format } = pickCellSource(bitmap, foreground, bg)

      const uniqueSpecIds = new Set<string>(template.items.map((it) => it.photoSpecId))
      const map = new Map<string, HTMLCanvasElement>()

      for (const id of uniqueSpecIds) {
        const spec = BUILTIN_PHOTO_SPECS.find((s) => s.id === id)
        if (!spec) continue
        const frame =
          spec.id === activeCropSpec?.id && activeCropFrame
            ? activeCropFrame
            : centerCrop({ width: bitmap.width, height: bitmap.height }, aspectRatio(spec))
        try {
          const result = await exportSingle({
            foreground: source,
            bg: effectiveBg,
            format,
            targetPixels: pickTargetPixels(spec),
            frame,
          })
          // `result.blob` is already produced but we want an in-memory
          // canvas, so re-decode then paint. Faster than blob → image
          // → canvas in tight loops.
          const decoded = await blobToBitmap(result.blob)
          const canvas = document.createElement('canvas')
          canvas.width = decoded.width
          canvas.height = decoded.height
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.drawImage(decoded, 0, 0)
          decoded.close?.()
          map.set(id, canvas)
        } catch {
          // Skip this spec — placeholder will render in its place.
        }
      }
      foreground?.close?.()
      if (cancelled) return
      setCellImages(map)
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [bitmap, mask, bg, activeCropSpec, activeCropFrame, template])

  // 2. Render the layout whenever cell images, settings, paper or
  // template change. We pay for the off-screen render only when the
  // user is on the layout tab (the parent decides when to mount us).
  useEffect(() => {
    let cancelled = false
    const work = async () => {
      await null
      if (cancelled) return
      setBusy(true)
      const result = renderLayout({
        paper,
        template,
        getSpec: (id) => BUILTIN_PHOTO_SPECS.find((s) => s.id === id) ?? null,
        getCellImage: (spec) => cellImages.get(spec.id) ?? null,
        settingsOverride: settings,
        dpi: PREVIEW_DPI,
      })
      if (cancelled) return
      const target = canvasRef.current
      if (target) {
        target.width = result.canvas.width
        target.height = result.canvas.height
        const ctx = target.getContext('2d')
        if (ctx) ctx.drawImage(result.canvas, 0, 0)
      }
      setOverflow(result.overflow)
      setBusy(false)
      onRendered?.(result)
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [paper, template, settings, cellImages, onRendered])

  const aspect = useMemo(() => `${paper.width_mm} / ${paper.height_mm}`, [paper])
  const maxWidth =
    paper.width_mm >= paper.height_mm
      ? PREVIEW_MAX_CSS_PX
      : PREVIEW_MAX_CSS_PX * (paper.width_mm / paper.height_mm)

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        aria-busy={busy}
      >
        <canvas
          ref={canvasRef}
          className="block h-auto w-full max-w-full"
          style={{ aspectRatio: aspect, maxWidth }}
          aria-label={t('canvasLabel')}
        />
      </div>
      {overflow.length > 0 ? (
        <p className="rounded-md border border-[var(--color-warning,#f59e0b)] bg-[var(--color-warning-soft,#fef3c7)] px-3 py-2 text-xs text-[var(--color-warning-text,#92400e)]">
          {t('overflow', {
            list: overflow.map((o) => `${o.spec.name.en} × ${o.count}`).join(', '),
          })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Choose target export pixels for a spec. We aim slightly higher than
 * the spec's native pixel box so cells stay sharp when the previewer
 * downscales for layout cells, but capped at 1200 px to stay fast.
 */
function pickTargetPixels(spec: PhotoSpec): { width: number; height: number } {
  const resolved = derivePixels(spec)
  const longest = Math.max(resolved.width_px, resolved.height_px)
  const scale = longest > 1200 ? 1200 / longest : 1
  return {
    width: Math.max(1, Math.round(resolved.width_px * scale)),
    height: Math.max(1, Math.round(resolved.height_px * scale)),
  }
}

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob)
  }
  // Fallback path — happy-dom / older browsers. Decode through <img>.
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img as unknown as ImageBitmap
  } finally {
    URL.revokeObjectURL(url)
  }
}

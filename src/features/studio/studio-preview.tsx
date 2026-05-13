'use client'

/**
 * Studio preview canvas.
 *
 * Renders the segmented portrait composited onto the currently-
 * selected background. Two layers, two draw calls:
 *
 *   1. Background — solid colour or checkered transparency texture
 *   2. The cached "foreground" ImageBitmap (subject cut out on
 *      transparent), produced once per mask via `extractForeground`.
 *
 * When `before` is true, the layout switches to a two-pane
 * comparison: the left pane shows the original bitmap untouched,
 * the right pane shows the composite. The parent supplies a slider
 * to wipe between them.
 *
 * Background swaps cost just a `clearRect` + `fillRect` + `drawImage`
 * — well under the 50 ms target from PRD §5.3.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { BeforeAfterSlider } from '@/features/background/before-after-slider'
import { compositeOnto, extractForeground, type BgColor } from '@/features/background/composite'

interface StudioPreviewProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  /**
   * Decontaminated foreground RGBA produced by the segmentation
   * worker. When its dimensions match `bitmap`, the preview skips the
   * main-thread `extractForeground` pixel passes (M5 P2-2).
   */
  foreground?: ImageData | null
  bg: BgColor
  showCompare?: boolean
  /**
   * Optional overlay rendered absolutely on top of the composite
   * canvas. Used by the size tab to draw the crop frame + guidelines.
   * Hidden when `showCompare` is true (the slider has its own UI).
   */
  overlay?: React.ReactNode
}

const CHECKERBOARD_CLASS =
  'bg-[image:linear-gradient(45deg,var(--color-divider)_25%,transparent_25%),linear-gradient(-45deg,var(--color-divider)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-divider)_75%),linear-gradient(-45deg,transparent_75%,var(--color-divider)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]'

/**
 * Downscale an `ImageData` mask to fit a target width / height. Used
 * exclusively by the preview path so a full-resolution segmentation
 * mask can be paired with a preview-sized bitmap without re-running
 * inference. Native `drawImage` is plenty for an 8-bit alpha matte.
 */
async function resizeMask(mask: ImageData, w: number, h: number): Promise<ImageData> {
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = mask.width
  srcCanvas.height = mask.height
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) return mask
  srcCtx.putImageData(mask, 0, 0)

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = w
  dstCanvas.height = h
  const dstCtx = dstCanvas.getContext('2d')
  if (!dstCtx) return mask
  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = 'high'
  dstCtx.drawImage(srcCanvas, 0, 0, w, h)
  return dstCtx.getImageData(0, 0, w, h)
}

export function StudioPreview({
  bitmap,
  mask,
  foreground: precomputedForeground,
  bg,
  showCompare = false,
  overlay,
}: StudioPreviewProps) {
  // The cached cutout; recomputed whenever bitmap or mask changes.
  const [foreground, setForeground] = useState<ImageBitmap | null>(null)

  useEffect(() => {
    let cancelled = false
    const work = async () => {
      // Microtask boundary so the (very likely) immediate setForeground
      // below doesn't fire synchronously inside the effect body.
      await null
      if (cancelled) return
      if (!mask) {
        setForeground((prev) => {
          prev?.close?.()
          return null
        })
        return
      }
      // Fast path (M5 P2-2): when the worker already produced a
      // decontaminated foreground that matches `bitmap` pixel-for-
      // pixel, wrap it as an ImageBitmap and skip the matte +
      // spill suppression passes entirely. `previewBitmap` and the
      // worker foreground are both capped at the same long side, so
      // dimensions agree whenever the user landed here via the
      // studio flow.
      if (
        precomputedForeground &&
        precomputedForeground.width === bitmap.width &&
        precomputedForeground.height === bitmap.height
      ) {
        const fg = await createImageBitmap(precomputedForeground)
        if (cancelled) {
          fg.close?.()
          return
        }
        setForeground((prev) => {
          prev?.close?.()
          return fg
        })
        return
      }
      // The bitmap prop may be a downscaled `previewBitmap` (see
      // studio/store) while the mask is sized to the full-res source.
      // Resize the mask to match so `extractForeground` can pair the
      // alpha matte pixel-for-pixel with the displayed bitmap. The
      // mask is only used by the preview here — the export and layout
      // pipelines always pair the full bitmap with the full mask, so
      // output fidelity is unaffected.
      const fittedMask =
        mask.width === bitmap.width && mask.height === bitmap.height
          ? mask
          : await resizeMask(mask, bitmap.width, bitmap.height)
      if (cancelled) return
      const fg = await extractForeground(bitmap, fittedMask)
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
  }, [bitmap, mask, precomputedForeground])

  // Cleanup foreground on unmount.
  useEffect(() => {
    return () => {
      foreground?.close?.()
    }
    // foreground intentionally not in deps — we want this to fire on
    // unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Canvas paint is driven by a ref callback rather than an effect so
  // we re-paint whenever the DOM node mounts. This matters because
  // toggling `showCompare` reshapes the React tree (the canvas moves
  // in/out of `BeforeAfterSlider`), which causes React to unmount the
  // old <canvas> and mount a fresh one with a blank backing buffer.
  // An effect with `[bitmap, foreground, bg]` deps wouldn't re-fire in
  // that case, so the new canvas stayed empty and the wrapper div's
  // background colour bled through — that's what produced the all-blue
  // right pane in the compare slider.
  const compositeRefCallback = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (!foreground) {
        // While the mask is being applied for the first time, paint the
        // original bitmap so users see the photo, not a blank canvas.
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0)
        return
      }
      compositeOnto(ctx, foreground, bitmap.width, bitmap.height, bg)
    },
    [bitmap, foreground, bg],
  )

  const beforeRefCallback = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0)
    },
    [bitmap],
  )

  const aspect = useMemo(() => `${bitmap.width} / ${bitmap.height}`, [bitmap])

  const compositeNode = (
    <div
      className={
        'relative overflow-hidden ' + (bg.kind === 'transparent' ? CHECKERBOARD_CLASS : '')
      }
    >
      <canvas
        ref={compositeRefCallback}
        className="block h-auto w-full max-w-full"
        style={{
          aspectRatio: aspect,
          backgroundColor: bg.kind === 'color' ? bg.hex : 'transparent',
        }}
      />
      {overlay && !showCompare ? overlay : null}
    </div>
  )

  const beforeNode = (
    <div className="relative overflow-hidden">
      <canvas
        ref={beforeRefCallback}
        className="block h-auto w-full max-w-full"
        style={{ aspectRatio: aspect }}
      />
    </div>
  )

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {showCompare && mask ? (
        <BeforeAfterSlider before={beforeNode} after={compositeNode} />
      ) : (
        compositeNode
      )}
    </div>
  )
}

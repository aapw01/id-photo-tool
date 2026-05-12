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

import { useEffect, useMemo, useRef, useState } from 'react'

import { BeforeAfterSlider } from '@/features/background/before-after-slider'
import { compositeOnto, extractForeground, type BgColor } from '@/features/background/composite'

interface StudioPreviewProps {
  bitmap: ImageBitmap
  mask: ImageData | null
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

export function StudioPreview({
  bitmap,
  mask,
  bg,
  showCompare = false,
  overlay,
}: StudioPreviewProps) {
  // The cached cutout; recomputed whenever bitmap or mask changes.
  const [foreground, setForeground] = useState<ImageBitmap | null>(null)
  const compositeRef = useRef<HTMLCanvasElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)

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
      const fg = await extractForeground(bitmap, mask)
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

  // Cleanup foreground on unmount.
  useEffect(() => {
    return () => {
      foreground?.close?.()
    }
    // foreground intentionally not in deps — we want this to fire on
    // unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paint the composite layer whenever the cached foreground or bg changes.
  useEffect(() => {
    const canvas = compositeRef.current
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
  }, [bitmap, foreground, bg])

  // The "before" pane (original bitmap, no mask, no background change)
  // only paints when comparison mode is on.
  useEffect(() => {
    if (!showCompare) return
    const canvas = beforeRef.current
    if (!canvas) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
  }, [showCompare, bitmap])

  const aspect = useMemo(() => `${bitmap.width} / ${bitmap.height}`, [bitmap])

  const compositeNode = (
    <div
      className={
        'relative overflow-hidden ' + (bg.kind === 'transparent' ? CHECKERBOARD_CLASS : '')
      }
    >
      <canvas
        ref={compositeRef}
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
        ref={beforeRef}
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

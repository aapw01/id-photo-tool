'use client'

/**
 * Studio preview canvas.
 *
 * Renders a single canvas at the original image's intrinsic size,
 * scaled to fit via CSS. Two layers:
 *
 *   1. The original ImageBitmap.
 *   2. The mask's alpha multiplied into the original's alpha so we
 *      get the actual cutout (no green-screen, no checkerboard
 *      overlay — the canvas's transparent background, paired with the
 *      checkerboard pattern on its parent, shows the cutout).
 *
 * Re-renders whenever the bitmap or mask reference changes.
 */

import { useEffect, useRef } from 'react'

interface StudioPreviewProps {
  bitmap: ImageBitmap
  mask: ImageData | null
}

export function StudioPreview({ bitmap, mask }: StudioPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)

    if (!mask) return

    // Composite the cutout: multiply original alpha by mask alpha.
    // Use destination-in with a mask canvas — faster than per-pixel
    // walks for large images and respects the GPU when available.
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = mask.width
    maskCanvas.height = mask.height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return
    maskCtx.putImageData(mask, 0, 0)

    ctx.globalCompositeOperation = 'destination-in'
    // Stretch the mask onto the original size — the mask is already at
    // native resolution thanks to T09, but draw with explicit dest box
    // so the canvas API can re-rasterise without any DPR drift.
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
  }, [bitmap, mask])

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] bg-[image:linear-gradient(45deg,var(--color-divider)_25%,transparent_25%),linear-gradient(-45deg,var(--color-divider)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-divider)_75%),linear-gradient(-45deg,transparent_75%,var(--color-divider)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]">
      <canvas
        ref={canvasRef}
        className="block h-auto w-full max-w-full"
        style={{ aspectRatio: `${bitmap.width} / ${bitmap.height}` }}
      />
    </div>
  )
}

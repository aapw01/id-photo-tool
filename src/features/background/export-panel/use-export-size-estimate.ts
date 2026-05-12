'use client'

/**
 * Debounced two-format file-size estimator.
 *
 * Estimates the file size of the *currently selected* format plus its
 * alpha cousin when a cut-out exists. We avoid estimating all four
 * formats simultaneously — on a 20 MP photo that runs four full
 * encode passes per quality-slider tick / mask change and starves the
 * click handler that triggers the actual download.
 *
 * The estimate is a hint, not an exact byte count, so we run it
 * against a single downscaled preview canvas (long side ≤
 * `ESTIMATE_LONGSIDE_PX`) built once per debounce tick. `exportSingle`
 * then takes its fast path (no frame, target === source dims) and the
 * encode never has to traverse a 20MP intermediate.
 *
 * Tail-debounced by `ESTIMATE_DEBOUNCE_MS` so dragging the quality
 * slider doesn't hammer the encoder.
 */

import { useEffect, useState } from 'react'

import { exportSingle, type ExportFormat } from '@/features/export'
import type { CropFrame } from '@/types/spec'

import { scaleFrameForForeground, type BgColor } from '../composite'

/** Long-side cap (in pixels) for the size-estimate preview canvas. */
export const ESTIMATE_LONGSIDE_PX = 1280
/** Tail-debounce window for the file-size estimate effect. */
export const ESTIMATE_DEBOUNCE_MS = 400

export type EstimateRecord = Record<ExportFormat, number | null>

interface UseExportSizeEstimateInput {
  exportSource: ImageBitmap | HTMLCanvasElement | null
  foreground: ImageBitmap | null
  bitmap: ImageBitmap
  bg: BgColor
  targetPixels: { width: number; height: number }
  frame?: CropFrame | null
  quality: number
  format: ExportFormat
}

const EMPTY: EstimateRecord = { 'png-alpha': null, 'png-flat': null, jpg: null, webp: null }

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

export function useExportSizeEstimate({
  exportSource,
  foreground,
  bitmap,
  bg,
  targetPixels,
  frame,
  quality,
  format,
}: UseExportSizeEstimateInput): EstimateRecord {
  const [estimates, setEstimates] = useState<EstimateRecord>(EMPTY)

  useEffect(() => {
    let cancelled = false
    if (!exportSource) {
      // React 19: defer the setState past the synchronous effect body.
      void (async () => {
        await null
        if (cancelled) return
        setEstimates(EMPTY)
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

        const next: EstimateRecord = { ...EMPTY }
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

  return estimates
}

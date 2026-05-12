/**
 * Compress an image so its on-disk size lands inside a target KB band.
 *
 * Strategy (TECH_DESIGN §6.5):
 *
 *   1. Binary-search JPEG / WebP quality between `qMin` and `qMax`,
 *      taking the encoder result that's closest to the target so far.
 *   2. If 6 quality probes don't land in `[target × 0.95, target × 1.05]`,
 *      shrink the canvas by `scaleStep` and retry. Pixel range stops
 *      at `minScale`; below that we surrender and return the best-so-far.
 *
 * The encode is delegated to an injectable `encode` function (defaults
 * to a real OffscreenCanvas / canvas.toBlob path). Tests inject a
 * synthetic encoder so we can exercise the search without pulling in
 * a JPEG codec.
 *
 * Pure logic — no DOM access in the default helpers when the caller
 * supplies a `bitmap` plus `encode`.
 */

import { canvasToBlob } from './export-single'

export type CompressFormat = 'jpg' | 'webp'

export interface CompressOptions {
  /** Source image; will be drawn into a canvas at each scale level. */
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas
  /** Target file size in KB (`1 KB = 1024 bytes`). */
  targetKB: number
  /** jpg → image/jpeg, webp → image/webp. */
  format?: CompressFormat
  /** Initial pixel dimensions (default: source's). */
  initialWidth?: number
  initialHeight?: number
  /** Acceptable band as a fraction of target. Default ±5 %. */
  tolerance?: number
  /** Quality probes per round. Default 6. */
  qualityProbes?: number
  /** Max scale rounds. Default 8. */
  maxScaleRounds?: number
  /** Scale factor applied each unsuccessful round. Default 0.9. */
  scaleStep?: number
  /** Minimum scale before giving up. Default 0.3. */
  minScale?: number
  /** Quality bounds. Default [0.3, 0.95]. */
  qualityRange?: [number, number]
  /** Encoder. Default → real canvas.toBlob. */
  encode?: EncodeFn
}

export type EncodeFn = (params: {
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
  quality: number
  mimeType: string
}) => Promise<Blob>

export interface CompressResult {
  blob: Blob
  /** Quality the encoder used to produce `blob`. */
  quality: number
  /** Scale relative to the initial size (`1` = no shrink). */
  scale: number
  /** Final size in KB. */
  finalKB: number
  /** True when within the configured tolerance band. */
  hit: boolean
  /** Best width × height the result was encoded at. */
  width: number
  height: number
  attempts: number
}

/**
 * Run the binary search. Always returns a result — when we can't hit
 * the band, `hit === false` and `blob` is the closest miss.
 */
export async function compressToKB(opts: CompressOptions): Promise<CompressResult> {
  const {
    source,
    targetKB,
    format = 'jpg',
    tolerance = 0.05,
    qualityProbes = 6,
    maxScaleRounds = 8,
    scaleStep = 0.9,
    minScale = 0.3,
    qualityRange = [0.3, 0.95],
    encode = defaultEncode,
  } = opts

  if (!Number.isFinite(targetKB) || targetKB <= 0) {
    throw new Error(`compressToKB: invalid targetKB ${targetKB}`)
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/webp'
  const baseWidth = opts.initialWidth ?? (source as ImageBitmap).width
  const baseHeight = opts.initialHeight ?? (source as ImageBitmap).height
  if (!baseWidth || !baseHeight) {
    throw new Error(`compressToKB: missing source dimensions (${baseWidth}×${baseHeight})`)
  }

  let scale = 1
  let attempts = 0
  let best: CompressResult | null = null

  for (let round = 0; round < maxScaleRounds; round++) {
    const width = Math.max(1, Math.round(baseWidth * scale))
    const height = Math.max(1, Math.round(baseHeight * scale))

    let lo = qualityRange[0]
    let hi = qualityRange[1]
    let quality = (lo + hi) / 2

    for (let probe = 0; probe < qualityProbes; probe++) {
      attempts++
      const blob = await encode({ source, width, height, quality, mimeType })
      const kb = blob.size / 1024
      const candidate: CompressResult = {
        blob,
        quality,
        scale,
        finalKB: kb,
        width,
        height,
        attempts,
        hit: false,
      }

      if (!best || Math.abs(kb - targetKB) < Math.abs(best.finalKB - targetKB)) {
        best = candidate
      }

      if (kb > targetKB * (1 + tolerance)) {
        hi = quality
      } else if (kb < targetKB * (1 - tolerance)) {
        lo = quality
      } else {
        // Inside the band — early return.
        return { ...candidate, hit: true }
      }
      quality = (lo + hi) / 2
    }

    // Round failed. If best is still over the band, we need fewer
    // pixels; if under, the JPEG encoder already saturated at the low
    // end and shrinking would only hurt — bail with the closest miss.
    if (best && best.finalKB <= targetKB) break

    scale = scale * scaleStep
    if (scale < minScale) break
  }

  if (!best) {
    throw new Error('compressToKB: encoder produced no blobs')
  }
  const hit =
    best.finalKB >= targetKB * (1 - tolerance) && best.finalKB <= targetKB * (1 + tolerance)
  return { ...best, hit }
}

/**
 * Default encoder — draws the source onto a canvas at the requested
 * size and runs `toBlob`. The export panel passes the cached
 * foreground here so we never re-extract the matte.
 */
async function defaultEncode({
  source,
  width,
  height,
  quality,
  mimeType,
}: Parameters<EncodeFn>[0]): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('compress: 2D context unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height)
  return canvasToBlob(canvas, mimeType, quality)
}

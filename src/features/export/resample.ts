/**
 * High-quality image resampling — native `drawImage` implementation.
 *
 * We previously routed downscales through Pica's Lanczos kernel, but
 * its Web Worker bootstrap was unreliable under Turbopack dev: the
 * worker sometimes failed to come up under blob:// scopes and the
 * `await pica.resize(...)` promise then never settled, freezing the
 * export with a forever-spinning button. Browser-native `drawImage`
 * with `imageSmoothingQuality = 'high'` is fast, deterministic, and —
 * for spec-sized ID-photo cells (≤ ~1200px on the long side) — visually
 * indistinguishable from a Lanczos pass.
 *
 * For aggressive downscales (target is less than half of the source on
 * either axis) we run the resampler in two steps: source → 2× target →
 * target. The intermediate hop keeps the bilinear filter inside its
 * accurate-enough range and produces edges every bit as crisp as the
 * old worker output without the failure mode.
 */

export interface ResampleOptions {
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas
  targetWidth: number
  targetHeight: number
  /**
   * Quality is kept on the signature for backwards compatibility but
   * is unused by the native implementation — `imageSmoothingQuality`
   * is always `'high'` and the two-step ladder handles aggressive
   * downscales. Provided so callers in the export pipeline don't need
   * to be edited in lockstep with the resampler.
   */
  quality?: 0 | 1 | 2 | 3
}

/**
 * Resample `source` into a fresh canvas at `targetWidth × targetHeight`.
 * Returns a DOM canvas so the caller can chain into `flattenIfNeeded`,
 * `canvas.toBlob`, or further composition.
 */
export async function resample({
  source,
  targetWidth,
  targetHeight,
}: ResampleOptions): Promise<HTMLCanvasElement> {
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(targetWidth))
  target.height = Math.max(1, Math.round(targetHeight))

  const src = toHtmlCanvas(source)

  // Two-step ladder when downscaling by more than 2× on either axis.
  // Native bilinear on a single hop visibly aliases past that ratio;
  // the intermediate 2× canvas keeps the kernel inside its sweet spot.
  const scaleX = target.width / src.width
  const scaleY = target.height / src.height
  const minScale = Math.min(scaleX, scaleY)

  if (minScale < 0.5 && src.width > target.width && src.height > target.height) {
    const intermW = Math.max(target.width, Math.round(target.width * 2))
    const intermH = Math.max(target.height, Math.round(target.height * 2))
    const interm = document.createElement('canvas')
    interm.width = Math.min(src.width, intermW)
    interm.height = Math.min(src.height, intermH)
    const ictx = interm.getContext('2d')
    if (ictx) {
      ictx.imageSmoothingEnabled = true
      ictx.imageSmoothingQuality = 'high'
      ictx.drawImage(src, 0, 0, interm.width, interm.height)
    }
    drawHighQuality(interm, target)
    return target
  }

  drawHighQuality(src, target)
  return target
}

function drawHighQuality(src: HTMLCanvasElement, target: HTMLCanvasElement): void {
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, target.width, target.height)
}

/**
 * Promote an `ImageBitmap` / `OffscreenCanvas` input into a DOM canvas
 * with a single `drawImage`. Exported for the export pipeline's
 * resample-skip fast path so it can stamp a background without
 * re-touching this module's internals.
 */
export function toHtmlCanvas(
  src: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
): HTMLCanvasElement {
  if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
    return src
  }
  const c = document.createElement('canvas')
  c.width = Math.max(1, (src as { width: number }).width)
  c.height = Math.max(1, (src as { height: number }).height)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.drawImage(src as unknown as CanvasImageSource, 0, 0)
  return c
}

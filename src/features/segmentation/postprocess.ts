/**
 * MODNet postprocessing pipeline.
 *
 * Takes the model's 512×512 alpha-matte output and projects it back into
 * the source image's coordinate system, producing a full-resolution RGBA
 * ImageData whose alpha channel carries the foreground mask. Areas
 * outside the cover-crop window are fully transparent.
 *
 * All helpers are pure and work without any browser APIs, so they can
 * be exercised in unit tests. Real `ImageBitmap` rasterization is the
 * worker's concern — see segment-core in T08/T09.
 */

import type { CropWindow } from './preprocess'

/**
 * Convert MODNet's raw float output to uint8 alpha values. Values are
 * clamped into [0, 1] before scaling so any small numeric drift around
 * the boundaries doesn't wrap around modulo 256.
 */
export function maskFloatToUint8(values: Float32Array | ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    out[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
  }
  return out
}

/**
 * Bilinear resize of a single-channel uint8 plane. The sampling grid
 * mirrors common image-processing conventions (no half-pixel offset),
 * which is the same convention the canvas's drawImage uses when going
 * the other direction in preprocess.
 */
export function bilinearResize(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    throw new RangeError('bilinearResize: dimensions must be positive')
  }
  if (src.length < srcW * srcH) {
    throw new RangeError(
      `bilinearResize: source length ${src.length} too short for ${srcW}×${srcH}`,
    )
  }

  const out = new Uint8Array(dstW * dstH)
  // Map dst index → src coord with the inclusive-end "scale" convention,
  // i.e. dst[0] samples src[0] and dst[dstW-1] samples src[srcW-1].
  const sx = dstW === 1 ? 0 : (srcW - 1) / (dstW - 1)
  const sy = dstH === 1 ? 0 : (srcH - 1) / (dstH - 1)

  for (let y = 0; y < dstH; y++) {
    const yf = y * sy
    const y0 = Math.floor(yf)
    const y1 = Math.min(y0 + 1, srcH - 1)
    const wy = yf - y0
    for (let x = 0; x < dstW; x++) {
      const xf = x * sx
      const x0 = Math.floor(xf)
      const x1 = Math.min(x0 + 1, srcW - 1)
      const wx = xf - x0

      const v00 = src[y0 * srcW + x0]!
      const v01 = src[y0 * srcW + x1]!
      const v10 = src[y1 * srcW + x0]!
      const v11 = src[y1 * srcW + x1]!
      const top = v00 + (v01 - v00) * wx
      const bot = v10 + (v11 - v10) * wx
      out[y * dstW + x] = Math.round(top + (bot - top) * wy)
    }
  }
  return out
}

/**
 * Compose a uint8 mask into an RGBA ImageData-like object sized at the
 * original image's resolution. The mask is placed inside `crop`; pixels
 * outside the crop window get alpha = 0 (treated as background).
 *
 * The RGB channels are filled with the foreground intent (255s) so the
 * resulting image, if rendered directly, shows the alpha mask as
 * white-on-transparent — handy for debugging and for "extract subject"
 * previews. The change-of-background pipeline in M3 will re-composite
 * the original photo against this mask.
 */
export function composeMaskIntoOriginal(
  mask: Uint8Array,
  maskW: number,
  maskH: number,
  origW: number,
  origH: number,
  crop: CropWindow,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (mask.length < maskW * maskH) {
    throw new RangeError(
      `composeMaskIntoOriginal: mask length ${mask.length} too short for ${maskW}×${maskH}`,
    )
  }
  const data = new Uint8ClampedArray(origW * origH * 4)
  // Compute the destination rect in original pixel space — crop is in
  // float source coords, round to nearest integers and clamp.
  const dx0 = Math.max(0, Math.round(crop.sx))
  const dy0 = Math.max(0, Math.round(crop.sy))
  const dx1 = Math.min(origW, Math.round(crop.sx + crop.sw))
  const dy1 = Math.min(origH, Math.round(crop.sy + crop.sh))
  const dstW = Math.max(0, dx1 - dx0)
  const dstH = Math.max(0, dy1 - dy0)

  if (dstW > 0 && dstH > 0) {
    const placed = bilinearResize(mask, maskW, maskH, dstW, dstH)
    for (let y = 0; y < dstH; y++) {
      const dstRow = (dy0 + y) * origW
      const srcRow = y * dstW
      for (let x = 0; x < dstW; x++) {
        const alpha = placed[srcRow + x]!
        const pixelIdx = (dstRow + dx0 + x) * 4
        data[pixelIdx + 0] = 255
        data[pixelIdx + 1] = 255
        data[pixelIdx + 2] = 255
        data[pixelIdx + 3] = alpha
      }
    }
  }
  return { data, width: origW, height: origH }
}

/**
 * Apply a contrast curve + low-end cutoff to a uint8 alpha plane.
 *
 * Why: MODNet's matte output is genuinely soft on portrait edges, which
 * is great for hair detail but bleeds through as a *halo* — a wide ring
 * of partially-transparent pixels — whenever the photo has a busy or
 * coloured background. Re-mapping the curve with a small low-end clip
 * and a steeper slope around the boundary removes most of that halo
 * while keeping the genuine edge transition.
 *
 *   normalised = (alpha / 255 - 0.5) * contrast + 0.5
 *   alpha_in  < cutoff * 255          → 0
 *   alpha_in  > (1 - cutoff) * 255    → 255
 *
 * Defaults were picked by eye against a set of failure photos
 * (dark hair + busy backgrounds, dark clothing on white seamless,
 * sunglasses + neutral wall): `cutoff = 0.18`, `contrast = 1.6` zaps
 * the visible halo without eating into real hair strands.
 *
 * Caller can pass `{ contrast: 1, cutoff: 0 }` to disable.
 */
export function refineAlpha(
  alpha: Uint8Array,
  opts: { cutoff?: number; contrast?: number } = {},
): Uint8Array {
  const cutoff = opts.cutoff ?? 0.18
  const contrast = opts.contrast ?? 1.6
  const loByte = cutoff * 255
  const hiByte = (1 - cutoff) * 255
  const out = new Uint8Array(alpha.length)
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]!
    if (a <= loByte) {
      out[i] = 0
      continue
    }
    if (a >= hiByte) {
      out[i] = 255
      continue
    }
    const normalised = (a / 255 - 0.5) * contrast + 0.5
    out[i] = normalised <= 0 ? 0 : normalised >= 1 ? 255 : Math.round(normalised * 255)
  }
  return out
}

/**
 * End-to-end postprocess: model output Float32 → RGBA ImageData at the
 * original photo's full resolution. T18 wraps this in the segmentation
 * worker so the main thread receives a transferable buffer.
 */
export function postprocessMask(
  modelOutput: Float32Array,
  origWidth: number,
  origHeight: number,
  crop: CropWindow,
  modelSize: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (modelOutput.length !== modelSize * modelSize) {
    throw new RangeError(
      `postprocessMask: expected ${modelSize * modelSize} model outputs, got ${modelOutput.length}`,
    )
  }
  const uint8 = maskFloatToUint8(modelOutput)
  const refined = refineAlpha(uint8)
  return composeMaskIntoOriginal(refined, modelSize, modelSize, origWidth, origHeight, crop)
}

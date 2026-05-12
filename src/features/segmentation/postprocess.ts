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
 * Apply a low-end cutoff and optional contrast curve to a uint8 alpha plane.
 *
 * Why: MODNet's matte output is genuinely soft on portrait edges, which
 * is great for hair detail but low-confidence wisps can bleed through as
 * a *halo* whenever the photo has a busy or coloured background. We only
 * kill the very low alpha floor here; higher alpha hair transitions are
 * preserved for the colour-decontamination pass in `extractForeground`.
 *
 *   normalised = (alpha / 255 - 0.5) * contrast + 0.5
 *   alpha_in  < cutoff * 255          → 0
 * Defaults intentionally avoid a high-end hard clip. The previous
 * `cutoff = 0.22`, `contrast = 1.8` curve made every alpha >= ~202 fully
 * opaque, which removed soft top-hair gradients and could create the
 * "flat head" artefact on ID-photo crops.
 *
 * Caller can pass `{ contrast: 1, cutoff: 0 }` to disable.
 */
export function refineAlpha(
  alpha: Uint8Array,
  opts: { cutoff?: number; contrast?: number } = {},
): Uint8Array {
  const cutoff = opts.cutoff ?? 0.22
  const contrast = opts.contrast ?? 1
  const loByte = cutoff * 255
  const out = new Uint8Array(alpha.length)
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]!
    if (a <= loByte) {
      out[i] = 0
      continue
    }
    if (a === 255) {
      out[i] = 255
      continue
    }
    const normalised = (a / 255 - 0.5) * contrast + 0.5
    out[i] = normalised <= 0 ? 0 : normalised >= 1 ? 255 : Math.round(normalised * 255)
  }
  return out
}

/**
 * Sample an average RGB colour from the "outer ring" of an RGBA buffer —
 * i.e. pixels that are *near* the subject (any opaque alpha neighbour
 * within `radius` px) but themselves transparent (alpha < `alphaLow`).
 *
 * These pixels are the strongest signal for the original photo's
 * background colour around the subject; if they cluster on one colour
 * we use that as the unmix target for semi-alpha decontamination.
 *
 * Implementation: a two-pass separable dilation produces a binary
 * `near-subject` mask in O(N · 2r) time, then we accumulate matching
 * pixels in one more O(N) pass. Returns `null` when the ring is empty
 * (e.g. fully-opaque buffer or no clear background pixels), in which
 * case decontamination is skipped.
 */
export function estimateOuterRingBg(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: { radius?: number; alphaLow?: number; alphaHigh?: number } = {},
): { r: number; g: number; b: number } | null {
  const radius = Math.max(1, Math.floor(opts.radius ?? 6))
  const alphaLow = opts.alphaLow ?? 12
  const alphaHigh = opts.alphaHigh ?? 240
  const total = width * height
  if (total <= 0 || rgba.length < total * 4) return null

  const subject = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (rgba[i * 4 + 3]! >= alphaHigh) subject[i] = 1
  }

  // Horizontal dilation: row[x] = 1 if any of subject[x-r..x+r] is 1.
  // Separable: keep a running count of subject pixels in the sliding
  // window, which collapses each row to O(W) instead of O(W · r).
  const horiz = new Uint8Array(total)
  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    let count = 0
    for (let x = 0; x < Math.min(radius + 1, width); x++) {
      count += subject[rowOff + x]!
    }
    for (let x = 0; x < width; x++) {
      horiz[rowOff + x] = count > 0 ? 1 : 0
      const addIdx = x + radius + 1
      if (addIdx < width) count += subject[rowOff + addIdx]!
      const dropIdx = x - radius
      if (dropIdx >= 0) count -= subject[rowOff + dropIdx]!
    }
  }

  // Vertical dilation of the horiz buffer produces the full square
  // dilation. Sliding sum again, this time over a column.
  const dilated = new Uint8Array(total)
  for (let x = 0; x < width; x++) {
    let count = 0
    for (let y = 0; y < Math.min(radius + 1, height); y++) {
      count += horiz[y * width + x]!
    }
    for (let y = 0; y < height; y++) {
      dilated[y * width + x] = count > 0 ? 1 : 0
      const addY = y + radius + 1
      if (addY < height) count += horiz[addY * width + x]!
      const dropY = y - radius
      if (dropY >= 0) count -= horiz[dropY * width + x]!
    }
  }

  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < total; i++) {
    if (!dilated[i]) continue
    if (subject[i]) continue
    const a = rgba[i * 4 + 3]!
    if (a > alphaLow) continue
    r += rgba[i * 4 + 0]!
    g += rgba[i * 4 + 1]!
    b += rgba[i * 4 + 2]!
    n++
  }
  if (n === 0) return null
  return { r: r / n, g: g / n, b: b / n }
}

/**
 * Decontaminate the colour halo around the matte's soft edge.
 *
 * Why: MODNet's alpha is correct, but the original photo's RGB at the
 * subject boundary is already a *mix* of subject and the photo's
 * original background colour (e.g. a red wall behind dark hair). Naive
 * `destination-in` keeps those mixed RGB values, so when the user
 * picks a transparent / different bg the old colour leaks through as a
 * visible ring.
 *
 * Fix: for every semi-alpha pixel, recover the *pure* foreground RGB
 * by unmixing the assumed background colour using the standard
 * compositing equation in reverse:
 *
 *     out_rgb = (rgb - (1 - α) · bg_rgb) / α
 *
 * The bg colour is estimated once from the outer-ring sample
 * (`estimateOuterRingBg`); when the ring is empty we skip the pass and
 * leave RGB untouched so we never *introduce* bad colour.
 *
 * Mutates `rgba` in place; cheap (single O(N) pass after the dilation).
 * Callers can pass an explicit `bg` to skip auto-estimation, useful
 * for tests and for gradient backgrounds where the global mean is a
 * poor estimator (the function falls back to a no-op then).
 */
export function decontaminateEdges(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: {
    bg?: { r: number; g: number; b: number }
    radius?: number
    alphaMin?: number
    alphaMax?: number
  } = {},
): { applied: number; bg: { r: number; g: number; b: number } | null } {
  const alphaMin = opts.alphaMin ?? 8
  const alphaMax = opts.alphaMax ?? 248
  const total = width * height
  if (total <= 0 || rgba.length < total * 4) return { applied: 0, bg: null }

  const bg = opts.bg ?? estimateOuterRingBg(rgba, width, height, { radius: opts.radius })
  if (!bg) return { applied: 0, bg: null }
  const bgR = bg.r
  const bgG = bg.g
  const bgB = bg.b

  let applied = 0
  for (let i = 0; i < total; i++) {
    const a = rgba[i * 4 + 3]!
    if (a <= alphaMin || a >= alphaMax) continue
    const alpha = a / 255
    const inv = 1 - alpha
    const r = (rgba[i * 4 + 0]! - inv * bgR) / alpha
    const g = (rgba[i * 4 + 1]! - inv * bgG) / alpha
    const b = (rgba[i * 4 + 2]! - inv * bgB) / alpha
    rgba[i * 4 + 0] = r <= 0 ? 0 : r >= 255 ? 255 : Math.round(r)
    rgba[i * 4 + 1] = g <= 0 ? 0 : g >= 255 ? 255 : Math.round(g)
    rgba[i * 4 + 2] = b <= 0 ? 0 : b >= 255 ? 255 : Math.round(b)
    applied++
  }
  return { applied, bg }
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

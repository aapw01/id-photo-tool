/**
 * MODNet preprocessing pipeline.
 *
 * The pretrained `Xenova/modnet` ONNX takes a 1×3×512×512 input tensor
 * in NCHW order with each pixel normalized from [0, 255] uint8 into
 * [-1, 1] float (i.e. `(x / 127.5) - 1`).
 *
 * The model is trained on a square 512² input. The first edition of
 * this pipeline used `cover` cropping, which guaranteed the human
 * subject filled the canvas but silently dropped the source pixels
 * that fell outside the centred square. For portrait ID photos where
 * the top of the head sits near the top of the frame that meant the
 * model literally never saw those pixels — and the resulting mask
 * had a hard horizontal line where the cover-crop window started.
 *
 * The current pipeline uses `letterbox` (contain) instead: the entire
 * source is scaled into the model canvas while preserving aspect, and
 * the remaining area is filled with neutral black (the [-1, -1, -1]
 * tensor value MODNet was trained to ignore on padded inputs). The
 * postprocess pass reads only the inner letterbox region of the model
 * output, so the mask covers the *full* source.
 *
 * The OffscreenCanvas-backed `preprocessBitmap` is browser-only. The
 * pure helpers (`computeCoverCrop`, `computeLetterbox`,
 * `imageDataToTensor`) are environment-agnostic so unit tests can
 * exercise the math without a canvas implementation.
 */

export const MODEL_SIZE = 512

export interface CropWindow {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Where the source image lands inside the model's input canvas under
 * letterbox / contain scaling. `scale` is the linear mapping factor
 * from source pixels to model-canvas pixels (always ≤ 1 for sources
 * larger than the model). `dx, dy` is the top-left padding offset.
 */
export interface Letterbox {
  /** Top-left of the source within the model canvas. */
  dx: number
  dy: number
  /** Size of the source inside the model canvas (preserves aspect). */
  dw: number
  dh: number
  /** scale = dw / srcW = dh / srcH. */
  scale: number
}

export interface PreprocessResult {
  tensor: Float32Array
  /** Plain CHW dims for convenient ort.Tensor construction in T10. */
  shape: readonly [1, 3, number, number]
  origWidth: number
  origHeight: number
  /** Position of the source within the model canvas — used by postprocess. */
  layout: Letterbox
}

/**
 * Compute the largest centered square (or fitting rectangle when
 * `dstW !== dstH`) that has the same aspect ratio as the destination.
 * No scaling is performed here — the result is a pure source-space
 * window that the canvas drawImage call will resample to `dstW × dstH`.
 */
export function computeCoverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CropWindow {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    throw new RangeError('computeCoverCrop: dimensions must be positive')
  }
  const srcAspect = srcW / srcH
  const dstAspect = dstW / dstH

  if (srcAspect > dstAspect) {
    // Source is wider than dst — crop sides.
    const sh = srcH
    const sw = sh * dstAspect
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh }
  }
  // Source is taller than (or as wide as) dst — crop top/bottom.
  const sw = srcW
  const sh = sw / dstAspect
  return { sx: 0, sy: (srcH - sh) / 2, sw, sh }
}

/**
 * Compute the centred letterbox / contain layout for fitting a source
 * rectangle inside a destination box without losing pixels. The whole
 * source ends up inside the box, the spare area is padding.
 */
export function computeLetterbox(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Letterbox {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    throw new RangeError('computeLetterbox: dimensions must be positive')
  }
  const scale = Math.min(dstW / srcW, dstH / srcH)
  // Round inner dims to integer pixels so the postprocess crop reads
  // whole-pixel rows out of the model output without re-aliasing.
  const dw = Math.max(1, Math.round(srcW * scale))
  const dh = Math.max(1, Math.round(srcH * scale))
  const dx = Math.floor((dstW - dw) / 2)
  const dy = Math.floor((dstH - dh) / 2)
  return { dx, dy, dw, dh, scale }
}

/**
 * Convert an ImageData (HWC, RGBA, uint8) into the model's input
 * Float32Array (NCHW, RGB only, normalized to [-1, 1]).
 *
 * Works on plain { data, width, height } objects so tests can pass in
 * fixtures without needing the browser ImageData constructor.
 */
export function imageDataToTensor(image: {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}): Float32Array {
  const { data, width, height } = image
  const pixelCount = width * height
  if (data.length < pixelCount * 4) {
    throw new RangeError(
      `imageDataToTensor: data length ${data.length} is too short for ${width}×${height} RGBA`,
    )
  }

  const tensor = new Float32Array(3 * pixelCount)
  const planeR = 0
  const planeG = pixelCount
  const planeB = pixelCount * 2

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    // (x / 127.5) - 1 maps [0, 255] -> [-1, 1] linearly.
    tensor[planeR + i] = data[offset]! / 127.5 - 1
    tensor[planeG + i] = data[offset + 1]! / 127.5 - 1
    tensor[planeB + i] = data[offset + 2]! / 127.5 - 1
    // alpha (offset + 3) is intentionally dropped — MODNet expects RGB only.
  }
  return tensor
}

/**
 * Browser-only: take an ImageBitmap, cover-crop to MODEL_SIZE², and
 * return the normalized input tensor + crop metadata.
 *
 * Uses OffscreenCanvas when available (works inside Web Workers and in
 * modern main threads), and falls back to a regular `<canvas>` when
 * running on the main thread without OffscreenCanvas.
 */
export async function preprocessBitmap(
  bitmap: ImageBitmap,
  size: number = MODEL_SIZE,
): Promise<PreprocessResult> {
  const layout = computeLetterbox(bitmap.width, bitmap.height, size, size)
  const imageData = drawLetterboxedImageData(bitmap, layout, size)
  const tensor = imageDataToTensor(imageData)
  return {
    tensor,
    shape: [1, 3, size, size],
    origWidth: bitmap.width,
    origHeight: bitmap.height,
    layout,
  }
}

function drawLetterboxedImageData(bitmap: ImageBitmap, layout: Letterbox, size: number): ImageData {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('preprocessBitmap: 2D context unavailable')
  // Fill the padding band with black so MODNet's input tensor sees
  // [-1, -1, -1] there. The model was trained on black-padded portrait
  // inputs and reliably outputs alpha ≈ 0 over that area, which is
  // what we want — the postprocess pass ignores it anyway.
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(
    bitmap,
    0,
    0,
    bitmap.width,
    bitmap.height,
    layout.dx,
    layout.dy,
    layout.dw,
    layout.dh,
  )
  return ctx.getImageData(0, 0, size, size)
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') {
    const el = document.createElement('canvas')
    el.width = width
    el.height = height
    return el
  }
  throw new Error('preprocessBitmap: no canvas implementation available in this environment')
}

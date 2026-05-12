/**
 * MODNet preprocessing pipeline.
 *
 * The pretrained `Xenova/modnet` ONNX takes a 1×3×512×512 input tensor
 * in NCHW order with each pixel normalized from [0, 255] uint8 into
 * [-1, 1] float (i.e. `(x / 127.5) - 1`). The model was trained on a
 * fixed 512² square, so we cover-crop the source to a 1:1 region first
 * and remember the crop window for inverse projection in postprocess.
 *
 * The OffscreenCanvas-backed `preprocessBitmap` is browser-only. The
 * pure helpers (`computeCoverCrop`, `imageDataToTensor`) are
 * environment-agnostic so unit tests can exercise the math without a
 * canvas implementation.
 */

export const MODEL_SIZE = 512

export interface CropWindow {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface PreprocessResult {
  tensor: Float32Array
  /** Plain CHW dims for convenient ort.Tensor construction in T10. */
  shape: readonly [1, 3, number, number]
  origWidth: number
  origHeight: number
  /** Source-image region that became the model input — used by postprocess. */
  crop: CropWindow
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
  const crop = computeCoverCrop(bitmap.width, bitmap.height, size, size)
  const imageData = drawCoverToImageData(bitmap, crop, size)
  const tensor = imageDataToTensor(imageData)
  return {
    tensor,
    shape: [1, 3, size, size],
    origWidth: bitmap.width,
    origHeight: bitmap.height,
    crop,
  }
}

function drawCoverToImageData(bitmap: ImageBitmap, crop: CropWindow, size: number): ImageData {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('preprocessBitmap: 2D context unavailable')
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size)
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

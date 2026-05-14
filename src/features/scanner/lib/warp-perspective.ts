'use client'

/**
 * Wrap OpenCV's `warpPerspective` into a tidy API that takes a
 * source `ImageBitmap` + 4 source corners + a target output size
 * and returns a rectified `Blob` (PNG by default; can be re-encoded
 * later in the pipeline).
 *
 * Why a Blob and not an `ImageBitmap`: the Scanner pipeline hands
 * the rectified result to:
 *   - `<img>` for in-DOM preview (Blob URL)
 *   - jsPDF for embedding into the A4 PDF (S5)
 *   - the localStorage history thumbnail (S8)
 * — all three consume bytes, not GPU textures. Re-decoding on
 * demand is cheap and avoids leaking texture memory.
 */

import type { OpenCV } from './opencv-loader'
import type { Quad } from './detect-corners'

export interface WarpPerspectiveOptions {
  /** Output width in pixels. */
  outputWidth: number
  /** Output height in pixels. */
  outputHeight: number
  /** Output image MIME type. Defaults to image/png (lossless). */
  mime?: string
  /** Encoding quality for lossy MIME types. Defaults to 0.92. */
  quality?: number
}

export interface WarpPerspectiveResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Perspective-warp `source` so that its `quad` corners map to the
 * four corners of an `outputWidth × outputHeight` image.
 *
 * The output is encoded as a `Blob` of `options.mime` (default
 * `image/png`). All OpenCV `Mat`s allocated internally are deleted
 * before return so the WASM heap doesn't grow unboundedly.
 */
export async function warpPerspective(
  cv: OpenCV,
  source: ImageBitmap,
  quad: Quad,
  options: WarpPerspectiveOptions,
): Promise<WarpPerspectiveResult> {
  const { outputWidth, outputHeight, mime = 'image/png', quality = 0.92 } = options

  // Draw the source onto a canvas first so OpenCV.js's `imread` can
  // pull a Mat out of it (it does not accept ImageBitmap directly).
  const inputCanvas = document.createElement('canvas')
  inputCanvas.width = source.width
  inputCanvas.height = source.height
  const inputCtx = inputCanvas.getContext('2d')
  if (!inputCtx) throw new Error('warpPerspective: failed to create input 2d context')
  inputCtx.drawImage(source, 0, 0)

  const src = cv.imread(inputCanvas)

  // Source point matrix (4 × 1 × CV_32FC2)
  const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad.topLeft.x,
    quad.topLeft.y,
    quad.topRight.x,
    quad.topRight.y,
    quad.bottomRight.x,
    quad.bottomRight.y,
    quad.bottomLeft.x,
    quad.bottomLeft.y,
  ])
  const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    outputWidth,
    0,
    outputWidth,
    outputHeight,
    0,
    outputHeight,
  ])
  const M = cv.getPerspectiveTransform(srcMat, dstMat)

  const warped = new cv.Mat()
  cv.warpPerspective(
    src,
    warped,
    M,
    new cv.Size(outputWidth, outputHeight),
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE,
    new cv.Scalar(0, 0, 0, 255),
  )

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight
  cv.imshow(outputCanvas, warped)

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('warpPerspective: canvas.toBlob returned null'))
      },
      mime,
      quality,
    )
  })

  // Tidy up all WASM heap allocations.
  src.delete()
  srcMat.delete()
  dstMat.delete()
  M.delete()
  warped.delete()

  return {
    blob,
    width: outputWidth,
    height: outputHeight,
  }
}

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
 *
 * Worker-first execution: the warp + PNG encode now run inside the
 * OpenCV worker (`opencv.worker.ts`) — both for the CV work and for
 * the encode step (via `OffscreenCanvas.convertToBlob`) — so the main
 * thread stays free for UI input. When the worker is unavailable, we
 * fall back to the legacy synchronous main-thread implementation.
 */

import { loadOpenCV, type OpenCV } from './opencv-loader'
import { OpenCVWorkerUnavailableError, rectifyInWorker } from './opencv-worker-client'
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
 * `image/png`).
 */
export async function warpPerspective(
  source: ImageBitmap,
  quad: Quad,
  options: WarpPerspectiveOptions,
): Promise<WarpPerspectiveResult> {
  const { outputWidth, outputHeight, mime = 'image/png', quality = 0.92 } = options
  try {
    return await rectifyInWorker({
      bitmap: source,
      quad,
      outputWidth,
      outputHeight,
      mime,
      quality,
    })
  } catch (err) {
    if (err instanceof OpenCVWorkerUnavailableError) {
      const cv = await loadOpenCV()
      return warpPerspectiveOnMainThread(cv, source, quad, {
        outputWidth,
        outputHeight,
        mime,
        quality,
      })
    }
    throw err
  }
}

/**
 * Legacy main-thread implementation, kept verbatim from the
 * pre-worker codebase so the fallback path is bit-identical to the
 * old behavior. New callers should use `warpPerspective` above.
 */
async function warpPerspectiveOnMainThread(
  cv: OpenCV,
  source: ImageBitmap,
  quad: Quad,
  options: Required<
    Pick<WarpPerspectiveOptions, 'outputWidth' | 'outputHeight' | 'mime' | 'quality'>
  >,
): Promise<WarpPerspectiveResult> {
  const { outputWidth, outputHeight, mime, quality } = options

  const inputCanvas = document.createElement('canvas')
  inputCanvas.width = source.width
  inputCanvas.height = source.height
  const inputCtx = inputCanvas.getContext('2d')
  if (!inputCtx) throw new Error('warpPerspective: failed to create input 2d context')
  inputCtx.drawImage(source, 0, 0)

  const src = cv.imread(inputCanvas)
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

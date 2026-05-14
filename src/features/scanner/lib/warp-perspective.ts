'use client'

/**
 * Perspective warp facade: takes a source `ImageBitmap` + a 4-point
 * `Quad` describing where the document sits inside it + a target
 * output size, returns a rectified `Blob` (PNG by default).
 *
 * Two execution paths share a single pure-JS kernel
 * (`perspective.ts`):
 *
 *   1. Worker path (default): posts to `warp.worker.ts`, which runs
 *      the homography solve + bilinear warp + Blob encode inside an
 *      OffscreenCanvas. The main thread sees no work between the
 *      post and the reply.
 *
 *   2. Main-thread fallback: when `Worker` / `OffscreenCanvas` aren't
 *      available (happy-dom in tests, some legacy WebViews), the
 *      same kernel runs on the main thread against a regular
 *      `<canvas>`. Sub-second for ID-card-sized inputs but blocks UI.
 *
 * Why Blob, not ImageBitmap: the rectified output feeds three
 * downstream consumers — `<img>` preview, jsPDF embed, history
 * thumbnail — all of which want bytes, not GPU textures.
 */

import type { Quad } from './detect-corners'
import { getPerspectiveTransform, warpPerspectiveBilinear } from './perspective'
import { rectifyInWorker, WarpWorkerUnavailableError } from './warp-worker-client'

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
    if (err instanceof WarpWorkerUnavailableError) {
      return warpPerspectiveOnMainThread(source, quad, { outputWidth, outputHeight, mime, quality })
    }
    throw err
  }
}

/**
 * Fallback path: identical numeric pipeline to the worker, but the
 * pixel loop and the PNG encode happen on the main thread against a
 * regular `<canvas>`. The two paths share `perspective.ts`, so the
 * output is bit-identical.
 */
async function warpPerspectiveOnMainThread(
  source: ImageBitmap,
  quad: Quad,
  options: Required<
    Pick<WarpPerspectiveOptions, 'outputWidth' | 'outputHeight' | 'mime' | 'quality'>
  >,
): Promise<WarpPerspectiveResult> {
  const { outputWidth, outputHeight, mime, quality } = options

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = source.width
  srcCanvas.height = source.height
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) throw new Error('warpPerspective: failed to create input 2d context')
  srcCtx.drawImage(source, 0, 0)
  const srcImageData = srcCtx.getImageData(0, 0, source.width, source.height)

  const dstQuad: Quad = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: outputWidth, y: 0 },
    bottomRight: { x: outputWidth, y: outputHeight },
    bottomLeft: { x: 0, y: outputHeight },
  }
  const forward = getPerspectiveTransform(quad, dstQuad)
  const warped = warpPerspectiveBilinear(srcImageData, forward, outputWidth, outputHeight)

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = outputWidth
  dstCanvas.height = outputHeight
  const dstCtx = dstCanvas.getContext('2d')
  if (!dstCtx) throw new Error('warpPerspective: failed to create output 2d context')
  dstCtx.putImageData(warped, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    dstCanvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('warpPerspective: canvas.toBlob returned null'))
      },
      mime,
      quality,
    )
  })

  return { blob, width: outputWidth, height: outputHeight }
}

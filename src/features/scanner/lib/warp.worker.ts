/**
 * Pure-JS warp Web Worker entry.
 *
 * Hosts the perspective warp + PNG encode off the main thread so the
 * ~150-400 ms pixel loop for an ID-card-sized rectify can't stall UI
 * input. There is no model / native dependency to load anymore — the
 * worker is ready as soon as the JS chunk lands.
 *
 * History: replaced the OpenCV-backed worker once Scanner switched
 * to a hand-port of `getPerspectiveTransform` + `warpPerspective`.
 * No `importScripts`, no WASM compile, no 10 MB self-hosted bundle.
 *
 * Wire protocol: every request carries an `id`; every response echoes
 * that `id` so concurrent calls can be paired. ImageBitmap inputs
 * travel as structured-cloned values (see `warp-worker-client.ts`
 * for why we don't transfer them).
 */

import { getPerspectiveTransform, warpPerspectiveBilinear } from './perspective'
import type {
  ErrorResponse,
  RectifyResponse,
  WorkerRequest,
  WorkerResponse,
} from './warp-worker-protocol'
import type { Quad } from './detect-corners'

// `self` types as Window in the project's DOM-only tsconfig. Narrow
// to the worker surface we actually touch — keeps the file properly
// typed without dragging in the WebWorker lib (which would collide
// with DOM types in client modules sharing this codebase).
const workerScope = self as unknown as {
  postMessage: (data: WorkerResponse, transfer?: Transferable[]) => void
  addEventListener: (type: 'message', handler: (event: MessageEvent<WorkerRequest>) => void) => void
}

workerScope.addEventListener('message', (event) => {
  void handle(event.data)
})

async function handle(req: WorkerRequest): Promise<void> {
  try {
    switch (req.type) {
      case 'ping': {
        reply({ id: req.id, type: 'ping:done' })
        return
      }
      case 'rectify': {
        const {
          bitmap,
          quad,
          outputWidth,
          outputHeight,
          mime = 'image/png',
          quality = 0.92,
        } = req.payload
        const r = await rectifyPipeline(bitmap, quad, outputWidth, outputHeight, mime, quality)
        const out: RectifyResponse = {
          id: req.id,
          type: 'rectify:done',
          payload: r,
        }
        reply(out)
        return
      }
    }
  } catch (err) {
    const out: ErrorResponse = {
      id: req.id,
      type: 'error',
      payload: { message: err instanceof Error ? err.message : String(err) },
    }
    reply(out)
  }
}

function reply(message: WorkerResponse): void {
  workerScope.postMessage(message)
}

/**
 * One-shot warp: draw the source bitmap into an OffscreenCanvas to
 * snapshot its pixels, solve the homography, run the bilinear warp,
 * paint the result into a second OffscreenCanvas, encode to Blob.
 *
 * Done inside the worker so the encode pass (which CPU-blocks for
 * 50-150 ms on large outputs) also stays off the main thread.
 */
async function rectifyPipeline(
  bitmap: ImageBitmap,
  quad: Quad,
  outputWidth: number,
  outputHeight: number,
  mime: string,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcCanvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) throw new Error('Worker: failed to acquire 2d context on source OffscreenCanvas')
  srcCtx.drawImage(bitmap, 0, 0)
  const srcImageData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height)

  const dstQuad: Quad = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: outputWidth, y: 0 },
    bottomRight: { x: outputWidth, y: outputHeight },
    bottomLeft: { x: 0, y: outputHeight },
  }
  const forward = getPerspectiveTransform(quad, dstQuad)
  const warped = warpPerspectiveBilinear(srcImageData, forward, outputWidth, outputHeight)

  const dstCanvas = new OffscreenCanvas(outputWidth, outputHeight)
  const dstCtx = dstCanvas.getContext('2d')
  if (!dstCtx) throw new Error('Worker: failed to acquire 2d context on output OffscreenCanvas')
  dstCtx.putImageData(warped, 0, 0)
  const blob = await dstCanvas.convertToBlob({ type: mime, quality })
  return { blob, width: outputWidth, height: outputHeight }
}

// Mark the file as a module so TypeScript treats it as such even
// though it has no top-level user exports.
export {}

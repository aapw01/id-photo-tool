/**
 * OpenCV.js Web Worker entry.
 *
 * Hosts the full CV pipeline (corner detection + perspective warp +
 * PNG encode) off the main thread so neither the ~10 MB opencv.js
 * parse + WASM compile nor the subsequent CPU-bound CV work can
 * freeze UI interaction. Before this worker existed, the loader
 * appended opencv.js to `document.head` and the browser had to parse
 * + compile it inline — UI clicks stalled for 0.5–2 s while the next
 * upload was being staged.
 *
 * Why a classic (non-module) worker: classic workers expose the
 * synchronous `importScripts` API, which lets us pull in the
 * self-hosted `/vendor/opencv/<ver>/opencv.js` bundle the same way
 * the main thread used to. Module workers would force us into
 * fetch+eval gymnastics for the same effect — not worth it.
 *
 * Wire protocol: every request carries an `id`; every response
 * echoes that `id` so the main-thread client can pair concurrent
 * calls. Blobs return as plain serializable values; ImageBitmap
 * inputs travel as structured-cloned values (see the comment in
 * `opencv-worker-client.ts` for why we don't transfer them).
 */

import type {
  WorkerRequest,
  WorkerResponse,
  DetectCornersResponse,
  RectifyResponse,
  ErrorResponse,
} from './opencv-worker-protocol'
import type { CVMat, CVMatVector, OpenCV } from './opencv-loader'
import type { Quad, QuadPoint } from './detect-corners'

const OPENCV_VERSION = '4.10.0'
const OPENCV_URL = `/vendor/opencv/${OPENCV_VERSION}/opencv.js`
const RUNTIME_INIT_TIMEOUT_MS = 30_000
const RUNTIME_POLL_INTERVAL_MS = 50

const WORK_LONGSIDE_PX = 1024
const TOPK_CONTOURS = 5
const MIN_AREA_RATIO = 0.1

// `self` is typed as Window in our DOM-only tsconfig. Narrow to the
// worker-shaped subset we actually call, so the rest of the file can
// stay properly typed without dragging in the WebWorker lib (which
// would conflict with DOM types in client modules).
const workerScope = self as unknown as {
  importScripts: (...urls: string[]) => void
  cv?: OpenCV | (PromiseLike<OpenCV> & Partial<OpenCV>)
  postMessage: (data: WorkerResponse, transfer?: Transferable[]) => void
  addEventListener: (type: 'message', handler: (event: MessageEvent<WorkerRequest>) => void) => void
}

let cvReady: Promise<OpenCV> | null = null

function ensureCV(): Promise<OpenCV> {
  if (cvReady) return cvReady
  cvReady = new Promise<OpenCV>((resolve, reject) => {
    try {
      workerScope.importScripts(OPENCV_URL)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }

    const start = Date.now()
    const tick = () => {
      const cv = workerScope.cv
      if (cv && isReadyOpenCV(cv)) {
        resolve(cv)
        return
      }
      // Some OpenCV.js builds expose `cv` as a thenable that resolves
      // to itself once the WASM runtime finishes booting.
      if (cv && typeof (cv as PromiseLike<OpenCV>).then === 'function') {
        ;(cv as PromiseLike<OpenCV>).then(
          (ready) => {
            if (isReadyOpenCV(ready)) {
              workerScope.cv = ready
              resolve(ready)
            } else {
              reject(new Error('OpenCV initialized but cv.Mat is unavailable'))
            }
          },
          (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
        )
        return
      }
      if (Date.now() - start > RUNTIME_INIT_TIMEOUT_MS) {
        reject(
          new Error(`OpenCV runtime initialization timed out after ${RUNTIME_INIT_TIMEOUT_MS} ms`),
        )
        return
      }
      setTimeout(tick, RUNTIME_POLL_INTERVAL_MS)
    }
    tick()
  })

  cvReady.catch(() => {
    cvReady = null
  })
  return cvReady
}

function isReadyOpenCV(
  candidate: OpenCV | (PromiseLike<OpenCV> & Partial<OpenCV>),
): candidate is OpenCV {
  return typeof (candidate as Partial<OpenCV>).Mat === 'function'
}

/**
 * OpenCV.js's `imread` only accepts HTMLCanvasElement / HTMLImageElement
 * — neither exist in a Worker scope. The canonical workaround is to
 * paint onto an OffscreenCanvas and feed the resulting ImageData into
 * `cv.matFromImageData`, which produces a 4-channel (RGBA) Mat.
 */
function bitmapToMat(cv: OpenCV, bitmap: ImageBitmap, w: number, h: number): CVMat {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Worker: failed to acquire 2d context on OffscreenCanvas')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  return (cv as unknown as { matFromImageData: (d: ImageData) => CVMat }).matFromImageData(data)
}

function detectCornersPipeline(cv: OpenCV, bitmap: ImageBitmap): { quad: Quad; detected: boolean } {
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > WORK_LONGSIDE_PX ? WORK_LONGSIDE_PX / longest : 1
  const workW = Math.max(1, Math.round(bitmap.width * scale))
  const workH = Math.max(1, Math.round(bitmap.height * scale))

  const src = bitmapToMat(cv, bitmap, workW, workH)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const contours: CVMatVector = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 75, 200)
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const candidates: { area: number; contour: CVMat }[] = []
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i)
      candidates.push({ area: cv.contourArea(c), contour: c })
    }
    candidates.sort((a, b) => b.area - a.area)

    const imageArea = workW * workH
    let bestQuad: Quad | null = null

    for (let i = 0; i < Math.min(TOPK_CONTOURS, candidates.length); i++) {
      const { area, contour } = candidates[i]!
      if (area / imageArea < MIN_AREA_RATIO) break
      const peri = cv.arcLength(contour, true)
      // Same epsilon ladder as the original main-thread pipeline.
      const epsilons = [0.02, 0.03, 0.05, 0.07]
      for (const eps of epsilons) {
        const approx = new cv.Mat()
        try {
          cv.approxPolyDP(contour, approx, peri * eps, true)
          if (approx.rows === 4) {
            const pts: QuadPoint[] = [
              { x: approx.data32S[0]!, y: approx.data32S[1]! },
              { x: approx.data32S[2]!, y: approx.data32S[3]! },
              { x: approx.data32S[4]!, y: approx.data32S[5]! },
              { x: approx.data32S[6]!, y: approx.data32S[7]! },
            ]
            bestQuad = orderClockwise(pts)
            break
          }
        } finally {
          approx.delete()
        }
      }
      if (bestQuad) break
    }

    if (!bestQuad) {
      return { quad: imageCorners(bitmap), detected: false }
    }
    const inv = 1 / scale
    return { quad: scaleQuad(bestQuad, inv, inv), detected: true }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    contours.delete()
    hierarchy.delete()
  }
}

function imageCorners(b: ImageBitmap): Quad {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: b.width, y: 0 },
    bottomRight: { x: b.width, y: b.height },
    bottomLeft: { x: 0, y: b.height },
  }
}

function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  return {
    topLeft: { x: q.topLeft.x * sx, y: q.topLeft.y * sy },
    topRight: { x: q.topRight.x * sx, y: q.topRight.y * sy },
    bottomRight: { x: q.bottomRight.x * sx, y: q.bottomRight.y * sy },
    bottomLeft: { x: q.bottomLeft.x * sx, y: q.bottomLeft.y * sy },
  }
}

function orderClockwise(points: QuadPoint[]): Quad {
  const m = points.map((p) => ({ p, sum: p.x + p.y, diff: p.y - p.x }))
  return {
    topLeft: m.reduce((a, b) => (a.sum <= b.sum ? a : b)).p,
    topRight: m.reduce((a, b) => (a.diff <= b.diff ? a : b)).p,
    bottomRight: m.reduce((a, b) => (a.sum >= b.sum ? a : b)).p,
    bottomLeft: m.reduce((a, b) => (a.diff >= b.diff ? a : b)).p,
  }
}

async function warpPipeline(
  cv: OpenCV,
  bitmap: ImageBitmap,
  quad: Quad,
  outputWidth: number,
  outputHeight: number,
  mime: string,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const src = bitmapToMat(cv, bitmap, bitmap.width, bitmap.height)
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

  try {
    cv.warpPerspective(
      src,
      warped,
      M,
      new cv.Size(outputWidth, outputHeight),
      cv.INTER_LINEAR,
      cv.BORDER_REPLICATE,
      new cv.Scalar(0, 0, 0, 255),
    )

    // warped is RGBA Uint8 (4 channels, same as source). Copy into a
    // fresh Uint8ClampedArray so the resulting ImageData isn't a view
    // into the WASM heap — once `warped.delete()` runs in the finally
    // block, the underlying buffer is freed.
    const clamped = new Uint8ClampedArray(warped.data)
    const imgData = new ImageData(clamped, outputWidth, outputHeight)
    const out = new OffscreenCanvas(outputWidth, outputHeight)
    const outCtx = out.getContext('2d')
    if (!outCtx) throw new Error('Worker: failed to acquire 2d context for output canvas')
    outCtx.putImageData(imgData, 0, 0)
    const blob = await out.convertToBlob({ type: mime, quality })
    return { blob, width: outputWidth, height: outputHeight }
  } finally {
    src.delete()
    srcMat.delete()
    dstMat.delete()
    M.delete()
    warped.delete()
  }
}

function reply(message: WorkerResponse): void {
  workerScope.postMessage(message)
}

workerScope.addEventListener('message', (event) => {
  void handle(event.data)
})

async function handle(req: WorkerRequest): Promise<void> {
  try {
    switch (req.type) {
      case 'ping': {
        // Force-load OpenCV during the ping so the next real request
        // hits a ready worker.
        await ensureCV()
        reply({ id: req.id, type: 'ping:done' })
        return
      }
      case 'detectCorners': {
        const cv = await ensureCV()
        const result = detectCornersPipeline(cv, req.payload.bitmap)
        const out: DetectCornersResponse = {
          id: req.id,
          type: 'detectCorners:done',
          payload: result,
        }
        reply(out)
        return
      }
      case 'rectify': {
        const cv = await ensureCV()
        const {
          bitmap,
          quad,
          outputWidth,
          outputHeight,
          mime = 'image/png',
          quality = 0.92,
        } = req.payload
        const r = await warpPipeline(cv, bitmap, quad, outputWidth, outputHeight, mime, quality)
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

// Mark the file as a module so TypeScript treats it as such even
// though it has no top-level imports/exports otherwise.
export {}

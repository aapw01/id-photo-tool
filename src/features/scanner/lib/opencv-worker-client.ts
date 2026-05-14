'use client'

/**
 * Main-thread client for the OpenCV.js Web Worker.
 *
 * Owns the worker singleton and the wire protocol — every request is
 * stamped with a fresh id; the worker echoes the id back so concurrent
 * calls can be paired up cleanly.
 *
 * Boots the worker lazily on the first `getOpenCVWorker()` call;
 * ScannerShell preheats it at mount so the user is unlikely to ever
 * actually wait for the ~10 MB opencv.js parse + WASM compile.
 *
 * ImageBitmap inputs are NOT listed as Transferable: the Scanner
 * keeps the source bitmap in its store so the corner editor can
 * redraw the underlying image and so re-rectification (when the user
 * tweaks the quad) can re-feed the same bitmap. Structured-cloning is
 * cheap for ImageBitmap in modern browsers (it shares the underlying
 * GPU-backed pixel data), so this is the right trade-off. Returned
 * Blobs travel as plain serializable values.
 *
 * Fallback: when `Worker` is unavailable (extremely rare — happy-dom
 * in tests, some legacy WebViews), `getOpenCVWorker()` rejects with
 * `OpenCVWorkerUnavailableError`. Callers in `detect-corners.ts` /
 * `warp-perspective.ts` detect this and route through the main-thread
 * `loadOpenCV()` path in `opencv-loader.ts`.
 */

import { OpenCVLoadError } from './opencv-loader'
import type { Quad } from './detect-corners'
import type {
  DetectCornersResponse,
  RectifyResponse,
  WorkerRequest,
  WorkerResponse,
} from './opencv-worker-protocol'

export class OpenCVWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenCVWorkerUnavailableError'
  }
}

interface PendingSlot {
  resolve: (msg: WorkerResponse) => void
  reject: (err: Error) => void
}

const PING_TIMEOUT_MS = 60_000

// Default factory wraps the canonical Next.js / Turbopack worker
// pattern. The factory is invoked lazily so module load never spawns
// a worker (matters for tests and for SSR import safety).
const defaultFactory: () => Worker = () =>
  new Worker(new URL('./opencv.worker.ts', import.meta.url))

let workerFactory: () => Worker = defaultFactory
let workerSingleton: Worker | null = null
let readyPromise: Promise<Worker> | null = null
const pending = new Map<string, PendingSlot>()
let counter = 0

function freshId(): string {
  counter++
  // Date prefix prevents collisions across HMR-induced module reloads.
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined'
}

function dispatchFatal(reason: Error): void {
  for (const [, slot] of pending) slot.reject(reason)
  pending.clear()
  if (workerSingleton) {
    try {
      workerSingleton.terminate()
    } catch {
      // best-effort cleanup
    }
  }
  workerSingleton = null
  readyPromise = null
}

export function getOpenCVWorker(): Promise<Worker> {
  if (readyPromise) return readyPromise
  if (!isWorkerSupported()) {
    return Promise.reject(
      new OpenCVWorkerUnavailableError('Web Workers are not available in this environment'),
    )
  }

  readyPromise = new Promise<Worker>((resolve, reject) => {
    let worker: Worker
    try {
      worker = workerFactory()
    } catch (err) {
      reject(new OpenCVWorkerUnavailableError(err instanceof Error ? err.message : String(err)))
      return
    }

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      const slot = pending.get(msg.id)
      if (!slot) return
      pending.delete(msg.id)
      slot.resolve(msg)
    })
    worker.addEventListener('error', (event) => {
      const message = (event as ErrorEvent).message ?? 'OpenCV worker fatal error'
      // The worker can't recover from a hard error on its own; reject
      // every outstanding promise and require a re-init on next call.
      dispatchFatal(new OpenCVLoadError('script_failed', message))
    })

    const pingId = freshId()
    const timeout = setTimeout(() => {
      pending.delete(pingId)
      reject(
        new OpenCVLoadError(
          'runtime_timeout',
          `OpenCV worker ping timed out after ${PING_TIMEOUT_MS} ms`,
        ),
      )
    }, PING_TIMEOUT_MS)

    pending.set(pingId, {
      resolve: (msg) => {
        clearTimeout(timeout)
        if (msg.type === 'ping:done') {
          workerSingleton = worker
          resolve(worker)
        } else if (msg.type === 'error') {
          reject(new OpenCVLoadError('runtime_missing', msg.payload.message))
        } else {
          reject(new OpenCVLoadError('runtime_missing', `Unexpected ping reply: ${msg.type}`))
        }
      },
      reject: (err) => {
        clearTimeout(timeout)
        reject(err)
      },
    })

    const pingMessage: WorkerRequest = { id: pingId, type: 'ping' }
    worker.postMessage(pingMessage)
  })

  readyPromise.catch(() => {
    readyPromise = null
    workerSingleton = null
  })

  return readyPromise
}

async function postAndWait<R extends WorkerResponse>(
  build: (id: string) => WorkerRequest,
  resultType: R['type'],
): Promise<R> {
  const worker = await getOpenCVWorker()
  const id = freshId()
  const request = build(id)
  return new Promise<R>((resolve, reject) => {
    pending.set(id, {
      resolve: (msg) => {
        if (msg.type === 'error') {
          reject(new Error(msg.payload.message))
        } else if (msg.type === resultType) {
          resolve(msg as R)
        } else {
          reject(new Error(`Unexpected worker reply: ${msg.type}`))
        }
      },
      reject,
    })
    worker.postMessage(request)
  })
}

export async function detectCornersInWorker(bitmap: ImageBitmap): Promise<{
  quad: Quad
  detected: boolean
}> {
  const reply = await postAndWait<DetectCornersResponse>(
    (id) => ({ id, type: 'detectCorners', payload: { bitmap } }),
    'detectCorners:done',
  )
  return reply.payload
}

export async function rectifyInWorker(args: {
  bitmap: ImageBitmap
  quad: Quad
  outputWidth: number
  outputHeight: number
  mime?: string
  quality?: number
}): Promise<{ blob: Blob; width: number; height: number }> {
  const reply = await postAndWait<RectifyResponse>(
    (id) => ({ id, type: 'rectify', payload: args }),
    'rectify:done',
  )
  return reply.payload
}

/**
 * Test seam: tests inject a fake Worker factory so they don't spawn
 * real worker threads (and so they aren't dependent on Vite's worker
 * transform being available under happy-dom). Pass `null` to restore
 * the default factory.
 */
export function __setWorkerFactoryForTesting(factory: (() => Worker) | null): void {
  if (workerSingleton) {
    try {
      workerSingleton.terminate()
    } catch {
      // best-effort cleanup
    }
  }
  workerSingleton = null
  readyPromise = null
  pending.clear()
  counter = 0
  workerFactory = factory ?? defaultFactory
}

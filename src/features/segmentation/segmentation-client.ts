/**
 * Main-thread side of the segmentation worker protocol.
 *
 * Owns a single Worker instance, multiplexes concurrent in-flight
 * requests by `id`, exposes a clean Promise-based API. Decoupled from
 * React so it's hostable in either a hook (T12) or a non-React script
 * (e.g. the perf-benchmark page in T19).
 */

import { normalizeErrorKind } from './errors'
import {
  isResponse,
  type Backend,
  type ErrorKind,
  type ProgressPhase,
  type SegmentRequest,
  type SegmentResponse,
} from './worker-protocol'

export interface ClientProgress {
  phase: ProgressPhase
  loaded?: number
  total?: number
}

export interface ClientError {
  kind: ErrorKind
  reason: string
}

export interface SegmentResult {
  mask: ImageData
  backend: Backend
  durationMs: number
}

export interface SegmentationClient {
  init(opts?: {
    onProgress?: (p: ClientProgress) => void
    forceBackend?: Backend
  }): Promise<{ backend: Backend }>
  segment(
    bitmap: ImageBitmap,
    opts?: { onProgress?: (p: ClientProgress) => void; signal?: AbortSignal },
  ): Promise<SegmentResult>
  dispose(): void
}

/**
 * Wraps a Worker behind the protocol. `workerFactory` is injected so
 * tests pass a mock without touching browser globals.
 */
export function createSegmentationClient(workerFactory: () => Worker): SegmentationClient {
  const worker = workerFactory()
  type Pending = {
    expect: 'ready' | 'result'
    resolve: (value: { backend: Backend } | SegmentResult) => void
    reject: (err: ClientError) => void
    onProgress?: (p: ClientProgress) => void
    abortListener?: () => void
    signal?: AbortSignal
  }
  const pending = new Map<string, Pending>()
  let nextId = 0
  let disposed = false

  function makeId(prefix: string): string {
    nextId += 1
    return `${prefix}-${nextId}`
  }

  function complete(id: string) {
    const entry = pending.get(id)
    if (!entry) return
    entry.signal?.removeEventListener('abort', entry.abortListener!)
    pending.delete(id)
  }

  worker.addEventListener('message', (event: MessageEvent) => {
    if (!isResponse(event.data)) return
    const msg = event.data as SegmentResponse
    const entry = pending.get(msg.id)
    if (!entry) return

    switch (msg.type) {
      case 'progress':
        entry.onProgress?.({ phase: msg.phase, loaded: msg.loaded, total: msg.total })
        return
      case 'ready':
        if (entry.expect === 'ready') {
          entry.resolve({ backend: msg.backend })
          complete(msg.id)
        }
        return
      case 'result':
        if (entry.expect === 'result') {
          const data = new Uint8ClampedArray(msg.mask)
          const imageData = new ImageData(data, msg.width, msg.height)
          entry.resolve({ mask: imageData, backend: msg.backend, durationMs: msg.durationMs })
          complete(msg.id)
        }
        return
      case 'error':
        entry.reject({ kind: normalizeErrorKind(msg.kind), reason: msg.reason })
        complete(msg.id)
        return
    }
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    // Worker died — fail every in-flight request so callers don't hang.
    for (const [id, entry] of pending.entries()) {
      entry.reject({
        kind: 'unknown',
        reason: event.message || 'Segmentation worker crashed',
      })
      complete(id)
    }
  })

  function send(req: SegmentRequest, transfer?: Transferable[]) {
    if (transfer && transfer.length > 0) {
      worker.postMessage(req, transfer)
    } else {
      worker.postMessage(req)
    }
  }

  function track<T extends { backend: Backend } | SegmentResult>(
    id: string,
    expect: 'ready' | 'result',
    opts: { onProgress?: (p: ClientProgress) => void; signal?: AbortSignal } | undefined,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: Pending = {
        expect,
        resolve: resolve as Pending['resolve'],
        reject,
        onProgress: opts?.onProgress,
        signal: opts?.signal,
      }
      if (opts?.signal) {
        if (opts.signal.aborted) {
          reject({ kind: 'unknown', reason: 'aborted' })
          return
        }
        entry.abortListener = () => {
          reject({ kind: 'unknown', reason: 'aborted' })
          pending.delete(id)
        }
        opts.signal.addEventListener('abort', entry.abortListener)
      }
      pending.set(id, entry)
    })
  }

  return {
    init(opts) {
      if (disposed) return Promise.reject<{ backend: Backend }>(disposedError())
      const id = makeId('init')
      const promise = track<{ backend: Backend }>(id, 'ready', opts)
      send({ type: 'init', id, forceBackend: opts?.forceBackend })
      return promise
    },
    segment(bitmap, opts) {
      if (disposed) return Promise.reject<SegmentResult>(disposedError())
      const id = makeId('seg')
      const promise = track<SegmentResult>(id, 'result', opts)
      // Bitmap is transferable; do NOT keep using it after this call —
      // the browser detaches it once postMessage completes.
      send({ type: 'segment', id, bitmap }, [bitmap])
      return promise
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const [id, entry] of pending.entries()) {
        entry.reject({ kind: 'unknown', reason: 'client disposed' })
        complete(id)
      }
      worker.terminate()
    },
  }
}

function disposedError(): ClientError {
  return { kind: 'unknown', reason: 'segmentation client disposed' }
}

/**
 * Production worker factory: creates the bundled Worker via the
 * `new URL(..., import.meta.url)` pattern Turbopack / webpack 5
 * understands. Each call mints a fresh Worker; the singleton lives
 * in use-segmentation.
 */
export function createDefaultWorker(): Worker {
  return new Worker(new URL('./segmentation.worker.ts', import.meta.url), {
    type: 'module',
    name: 'pixfit-segmentation',
  })
}

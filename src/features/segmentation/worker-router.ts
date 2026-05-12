/**
 * Worker-side protocol router, factored out of segmentation.worker.ts
 * so it can be unit-tested in Node without a real Worker context.
 *
 * Holds the single-session lifecycle (`ensureSession`) and turns raw
 * SegmentRequest messages into the right segment-core call followed
 * by a SegmentResponse, while normalising thrown errors into the
 * `ErrorKind` taxonomy.
 *
 * The real worker entry just wires this router to `self.postMessage`
 * and `self.addEventListener('message')`.
 */

import {
  loadSession as defaultLoadSession,
  processForeground as defaultProcessForeground,
  runSegment as defaultRunSegment,
  type LoadSessionOptions,
  type ProgressCallback,
  type SegmentSession,
} from './segment-core'
import type { ErrorKind, SegmentRequest, SegmentResponse } from './worker-protocol'

export interface WorkerHandlerDeps {
  post: (msg: SegmentResponse, transfer?: Transferable[]) => void
  /** Defaults to segment-core.loadSession. Swap for tests. */
  load?: (opts: LoadSessionOptions) => Promise<SegmentSession>
  /** Defaults to segment-core.runSegment. Swap for tests. */
  runSegment?: typeof defaultRunSegment
  /** Defaults to segment-core.processForeground. Swap for tests. */
  processForeground?: typeof defaultProcessForeground
}

export function classifyError(
  err: unknown,
  defaultKind: ErrorKind = 'unknown',
): { kind: ErrorKind; reason: string } {
  const reason = err instanceof Error ? err.message : String(err)
  // Heuristics: rely on the loader's IntegrityError / ModelNetworkError
  // names first (most specific), then keyword-match the message for
  // ort-internal errors that don't carry our class names.
  if (err instanceof Error) {
    if (err.name === 'IntegrityError') return { kind: 'integrity', reason }
    if (err.name === 'ModelNetworkError') return { kind: 'network', reason }
  }
  if (/integrity/i.test(reason)) return { kind: 'integrity', reason }
  if (/network|fetch|cors|timeout|connect/i.test(reason)) return { kind: 'network', reason }
  if (/inference|run failed|ort/i.test(reason)) return { kind: 'inference', reason }
  return { kind: defaultKind, reason }
}

export interface WorkerHandler {
  (msg: SegmentRequest): void
  /** Test seam: swap in a pre-existing session (skips load). */
  __setSessionForTesting(session: SegmentSession | null): void
}

export function createWorkerHandler(deps: WorkerHandlerDeps): WorkerHandler {
  const load = deps.load ?? defaultLoadSession
  const runSegment = deps.runSegment ?? defaultRunSegment
  const processForeground = deps.processForeground ?? defaultProcessForeground

  let session: SegmentSession | null = null
  let initPromise: Promise<SegmentSession> | null = null

  function makeProgress(id: string): ProgressCallback {
    return (phase, loaded, total) => deps.post({ type: 'progress', id, phase, loaded, total })
  }

  async function ensureSession(
    id: string,
    forceBackend?: SegmentSession['backend'],
  ): Promise<SegmentSession> {
    if (session) return session
    if (initPromise) return initPromise
    initPromise = load({ onProgress: makeProgress(id), forceBackend })
      .then((s) => {
        session = s
        return s
      })
      .finally(() => {
        initPromise = null
      })
    return initPromise
  }

  async function handleInit(id: string, forceBackend?: SegmentSession['backend']) {
    try {
      const s = await ensureSession(id, forceBackend)
      deps.post({ type: 'ready', id, backend: s.backend })
    } catch (err) {
      const { kind, reason } = classifyError(err, 'init')
      deps.post({ type: 'error', id, kind, reason })
    }
  }

  async function handleSegment(
    id: string,
    bitmap: ImageBitmap,
    withForeground: boolean,
    foregroundMaxLongSide: number | undefined,
  ) {
    try {
      const s = await ensureSession(id)
      const { mask, durationMs, backend } = await runSegment(s, bitmap, makeProgress(id))

      // Foreground extraction runs on the same MaskBuffer before the
      // mask buffer is transferred back to the main thread. A failure
      // here (e.g. OffscreenCanvas tainted) is non-fatal: drop the
      // foreground and let the caller fall back to the main-thread
      // path. The mask itself is still useful.
      let foreground: Awaited<ReturnType<typeof processForeground>> = null
      if (withForeground) {
        try {
          foreground = await processForeground(bitmap, mask, {
            maxLongSide: foregroundMaxLongSide,
          })
        } catch {
          foreground = null
        }
      }

      const transfer: Transferable[] = [mask.data.buffer]
      const response: SegmentResponse = {
        type: 'result',
        id,
        mask: mask.data.buffer,
        width: mask.width,
        height: mask.height,
        backend,
        durationMs,
      }
      if (foreground) {
        response.foreground = foreground.data.buffer
        response.foregroundWidth = foreground.width
        response.foregroundHeight = foreground.height
        transfer.push(foreground.data.buffer)
      }
      deps.post(response, transfer)
    } catch (err) {
      const { kind, reason } = classifyError(err, 'inference')
      deps.post({ type: 'error', id, kind, reason })
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close()
    }
  }

  const handler: WorkerHandler = ((msg: SegmentRequest) => {
    switch (msg.type) {
      case 'init':
        void handleInit(msg.id, msg.forceBackend)
        return
      case 'segment':
        void handleSegment(
          msg.id,
          msg.bitmap,
          msg.withForeground ?? false,
          msg.foregroundMaxLongSide,
        )
        return
      default: {
        // Exhaustiveness check; in practice the type system + the
        // discriminated union prevent this branch from firing.
        const exhaustive: never = msg
        deps.post({
          type: 'error',
          id: 'unknown',
          kind: 'unknown',
          reason: `Unknown message type: ${JSON.stringify(exhaustive)}`,
        })
      }
    }
  }) as WorkerHandler

  handler.__setSessionForTesting = (s) => {
    session = s
    initPromise = null
  }

  return handler
}

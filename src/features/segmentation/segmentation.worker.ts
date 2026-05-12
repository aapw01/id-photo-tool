/// <reference lib="webworker" />

/**
 * Segmentation Web Worker entry point.
 *
 * Responsibilities (M2-T06 scope):
 *   - Maintain a single SegmentSession instance for the lifetime of the worker.
 *   - Route incoming SegmentRequest messages to segment-core functions.
 *   - Post structured SegmentResponse messages back, with progress events
 *     in between.
 *   - Catch any thrown error and surface it as a typed `error` response;
 *     the worker must NEVER bubble an uncaught exception.
 *
 * Heavy lifting (model fetch, ONNX runtime init, real inference) lives in
 * segment-core.ts. The swap to a real ort.InferenceSession happens in
 * T07–T10 without changing this file.
 */

import { loadSession, runSegment, type ProgressCallback, type SegmentSession } from './segment-core'
import type { ErrorKind, SegmentRequest, SegmentResponse } from './worker-protocol'

declare const self: DedicatedWorkerGlobalScope

let session: SegmentSession | null = null
let initPromise: Promise<SegmentSession> | null = null

function post(msg: SegmentResponse, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(msg, transfer)
  } else {
    self.postMessage(msg)
  }
}

function makeProgress(id: string): ProgressCallback {
  return (phase, loaded, total) => post({ type: 'progress', id, phase, loaded, total })
}

function classifyError(
  err: unknown,
  defaultKind: ErrorKind = 'unknown',
): {
  kind: ErrorKind
  reason: string
} {
  const reason = err instanceof Error ? err.message : String(err)
  // Lightweight heuristics for M2-T06. T11 refines this with explicit
  // error classes thrown by the loader / runtime.
  if (/integrity/i.test(reason)) return { kind: 'integrity', reason }
  if (/network|fetch|cors|timeout/i.test(reason)) return { kind: 'network', reason }
  return { kind: defaultKind, reason }
}

async function ensureSession(id: string): Promise<SegmentSession> {
  if (session) return session
  if (initPromise) return initPromise
  initPromise = loadSession({ onProgress: makeProgress(id) })
    .then((s) => {
      session = s
      return s
    })
    .finally(() => {
      initPromise = null
    })
  return initPromise
}

async function handleInit(id: string) {
  try {
    const s = await ensureSession(id)
    post({ type: 'ready', id, backend: s.backend })
  } catch (err) {
    const { kind, reason } = classifyError(err, 'init')
    post({ type: 'error', id, kind, reason })
  }
}

async function handleSegment(id: string, bitmap: ImageBitmap) {
  try {
    const s = await ensureSession(id)
    const { mask, durationMs, backend } = await runSegment(s, bitmap, makeProgress(id))
    post(
      {
        type: 'result',
        id,
        mask: mask.data.buffer,
        width: mask.width,
        height: mask.height,
        backend,
        durationMs,
      },
      [mask.data.buffer],
    )
  } catch (err) {
    const { kind, reason } = classifyError(err, 'inference')
    post({ type: 'error', id, kind, reason })
  } finally {
    // Release the inbound bitmap promptly. close() is a no-op in test
    // environments where ImageBitmap is polyfilled as a plain object.
    if (typeof bitmap.close === 'function') bitmap.close()
  }
}

self.addEventListener('message', (event: MessageEvent<SegmentRequest>) => {
  const msg = event.data
  switch (msg.type) {
    case 'init':
      void handleInit(msg.id)
      return
    case 'segment':
      void handleSegment(msg.id, msg.bitmap)
      return
    default: {
      // Exhaustiveness check — surfaces protocol drift at compile time.
      const _exhaustive: never = msg
      post({
        type: 'error',
        id: 'unknown',
        kind: 'unknown',
        reason: `Unknown message type: ${JSON.stringify(_exhaustive)}`,
      })
    }
  }
})

/// <reference lib="webworker" />

/**
 * Segmentation Web Worker entry point.
 *
 * Thin shim that wires the testable `createWorkerHandler` from
 * worker-router.ts to the DedicatedWorkerGlobalScope. All routing,
 * lifecycle and error classification lives in worker-router so it can
 * be exercised in Node without a real Worker context (M2-T18).
 */

import { createWorkerHandler } from './worker-router'
import type { SegmentRequest, SegmentResponse } from './worker-protocol'

declare const self: DedicatedWorkerGlobalScope

const handler = createWorkerHandler({
  post: (msg: SegmentResponse, transfer?: Transferable[]) => {
    if (transfer && transfer.length > 0) {
      self.postMessage(msg, transfer)
    } else {
      self.postMessage(msg)
    }
  },
})

self.addEventListener('message', (event: MessageEvent<SegmentRequest>) => {
  handler(event.data)
})

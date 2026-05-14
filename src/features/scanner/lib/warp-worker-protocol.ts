/**
 * Wire protocol for the pure-JS warp Web Worker.
 *
 * Both `warp.worker.ts` (worker side) and `warp-worker-client.ts`
 * (main-thread side) `import type` from this file. Because type
 * imports are fully erased at compile time, this module emits zero
 * runtime JS — keeping the worker chunk free of accidental DOM-only
 * client imports.
 *
 * History: replaced the previous `opencv-worker-protocol.ts` once we
 * dropped the OpenCV.js dependency. Only `ping` (health-check during
 * worker boot) and `rectify` (the only CV operation Scanner ever
 * actually called) remain.
 */

import type { Quad } from './detect-corners'

export interface PingRequest {
  id: string
  type: 'ping'
}

export interface RectifyRequest {
  id: string
  type: 'rectify'
  payload: {
    bitmap: ImageBitmap
    quad: Quad
    outputWidth: number
    outputHeight: number
    mime?: string
    quality?: number
  }
}

export type WorkerRequest = PingRequest | RectifyRequest

export interface PongResponse {
  id: string
  type: 'ping:done'
}

export interface RectifyResponse {
  id: string
  type: 'rectify:done'
  payload: { blob: Blob; width: number; height: number }
}

export interface ErrorResponse {
  id: string
  type: 'error'
  payload: { message: string }
}

export type WorkerResponse = PongResponse | RectifyResponse | ErrorResponse

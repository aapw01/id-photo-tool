/**
 * Wire protocol for the OpenCV.js Web Worker.
 *
 * Both `opencv.worker.ts` (worker side) and `opencv-worker-client.ts`
 * (main-thread side) import these as `import type { ... }`. Because
 * type imports are fully erased at compile time, this file produces
 * zero runtime JS in either bundle — keeping the worker bundle from
 * accidentally dragging in DOM-only client modules.
 */

import type { Quad } from './detect-corners'

export interface PingRequest {
  id: string
  type: 'ping'
}

export interface DetectCornersRequest {
  id: string
  type: 'detectCorners'
  payload: { bitmap: ImageBitmap }
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

export type WorkerRequest = PingRequest | DetectCornersRequest | RectifyRequest

export interface PongResponse {
  id: string
  type: 'ping:done'
}

export interface DetectCornersResponse {
  id: string
  type: 'detectCorners:done'
  payload: { quad: Quad; detected: boolean }
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

export type WorkerResponse = PongResponse | DetectCornersResponse | RectifyResponse | ErrorResponse

/**
 * Worker-internal segmentation logic, factored out as pure functions so
 * we can unit-test the protocol flow without spawning a real Worker or
 * loading onnxruntime-web.
 *
 * The contract is intentionally minimal in M2-T06:
 *   - `loadSession()` returns *something* with a `run(bitmap)` method.
 *   - `runSegment()` produces a mask ArrayBuffer + dimensions + backend.
 *
 * In T07–T10 the stub session is replaced with a real ort.InferenceSession
 * (Cache-API-backed model loader + WebGPU/WASM provider selection). The
 * worker entrypoint segmentation.worker.ts depends only on the surface
 * defined here, so the swap is transparent.
 */

import { loadModel, type LoadModelOptions } from './model-loader'
import type { Backend, ProgressPhase } from './worker-protocol'

export type ProgressCallback = (phase: ProgressPhase, loaded?: number, total?: number) => void

/**
 * Inputs accepted by loadSession. `modelBuffer` is a test seam: pass a
 * pre-loaded ArrayBuffer to skip the network entirely (used by every
 * non-integration unit test). In production the worker calls
 * `loadSession({ onProgress })` and the loader handles caching + fetch.
 */
export interface LoadSessionOptions {
  onProgress?: ProgressCallback
  modelBuffer?: ArrayBuffer
  loaderOptions?: Omit<LoadModelOptions, 'onProgress'>
}

export interface SegmentSession {
  /** Best-effort tag — used to populate `backend` in responses. */
  readonly backend: Backend
  /**
   * Run inference on a bitmap and return an alpha mask.
   * Implementations must be safe to call concurrently; the worker
   * currently serializes calls but that may change.
   */
  run(bitmap: ImageBitmap): Promise<MaskBuffer>
}

export interface MaskBuffer {
  /** Single-channel 8-bit alpha mask, length = width * height. */
  data: Uint8Array
  width: number
  height: number
}

/**
 * Factory used by the worker. The session today is a stub that produces
 * a fully-opaque mask — T08/T09/T10 swap it for a real ort.InferenceSession
 * built from the loaded ArrayBuffer.
 */
export async function loadSession(opts: LoadSessionOptions = {}): Promise<SegmentSession> {
  const { onProgress, modelBuffer, loaderOptions } = opts

  const buffer =
    modelBuffer ??
    (await loadModel({
      ...loaderOptions,
      onProgress,
    }))

  onProgress?.('init', 1, 1)
  return new StubSession(buffer)
}

class StubSession implements SegmentSession {
  readonly backend: Backend = 'wasm'
  /**
   * Holding the buffer keeps it alive across calls and lets us inspect
   * its size in tests. T08 will replace this field with the real
   * ort.InferenceSession instance.
   */
  readonly modelByteLength: number

  constructor(buffer: ArrayBuffer) {
    this.modelByteLength = buffer.byteLength
  }

  async run(bitmap: ImageBitmap): Promise<MaskBuffer> {
    const { width, height } = bitmap
    const data = new Uint8Array(width * height)
    // 255 = fully foreground. M2-T09 swaps this for the real mask
    // produced by the ONNX model.
    data.fill(255)
    return { data, width, height }
  }
}

/**
 * High-level "run one inference" path used by the worker. Reports
 * progress and returns a transferable mask buffer.
 */
export async function runSegment(
  session: SegmentSession,
  bitmap: ImageBitmap,
  onProgress?: ProgressCallback,
): Promise<{ mask: MaskBuffer; durationMs: number; backend: Backend }> {
  onProgress?.('infer')
  const t0 = performance.now()
  const mask = await session.run(bitmap)
  const durationMs = performance.now() - t0
  return { mask, durationMs, backend: session.backend }
}

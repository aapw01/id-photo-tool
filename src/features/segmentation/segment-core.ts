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

import type { Backend, ProgressPhase } from './worker-protocol'

export type ProgressCallback = (phase: ProgressPhase, loaded?: number, total?: number) => void

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
 * Factory used by the worker. Today it returns a stub that produces a
 * fully-opaque mask matching the input bitmap. The stub keeps the message
 * protocol exercised end-to-end while T07/T08/T09 land the real pipeline.
 */
export async function loadSession(onProgress?: ProgressCallback): Promise<SegmentSession> {
  onProgress?.('download', 0, 1)
  // Simulate the model-load latency budget so the host hook's progress
  // wiring is observable in dev tools. ~50 ms is enough for the UI but
  // doesn't slow tests perceptibly.
  await new Promise<void>((res) => setTimeout(res, 50))
  onProgress?.('download', 1, 1)
  onProgress?.('init', 1, 1)

  return new StubSession()
}

class StubSession implements SegmentSession {
  readonly backend: Backend = 'wasm'

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

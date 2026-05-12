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

import { applyAlphaMatteToImageData } from '@/features/background/composite'

import { loadModel, type LoadModelOptions } from './model-loader'
import { createOrtSession } from './ort-session'
import type { Backend, ProgressPhase } from './worker-protocol'
import { DEFAULT_FOREGROUND_MAX_LONGSIDE } from './worker-protocol'

export type ProgressCallback = (phase: ProgressPhase, loaded?: number, total?: number) => void

/**
 * Inputs accepted by loadSession.
 *
 * `modelBuffer` lets the caller bypass the network (used by tests and
 * by the worker if it ever wants to reuse a buffer across instances).
 *
 * `__useStubSession` is a test-only seam: it forces a deterministic
 * stub instead of constructing a real ort.InferenceSession. Production
 * code never sets it; the worker just passes `onProgress`.
 */
export interface LoadSessionOptions {
  onProgress?: ProgressCallback
  modelBuffer?: ArrayBuffer
  loaderOptions?: Omit<LoadModelOptions, 'onProgress'>
  /** Force a specific backend for benchmarking / fallback testing. */
  forceBackend?: Backend
  __useStubSession?: boolean
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
  /**
   * RGBA image data carrying the mask. The alpha channel holds the
   * MODNet output; RGB is filled with foreground intent (255s) so the
   * buffer can be handed straight to `putImageData()` for preview.
   * `length === width * height * 4`.
   */
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Factory used by the worker. Builds a real ort.InferenceSession by
 * default; tests inject `__useStubSession: true` for hermeticity.
 */
export async function loadSession(opts: LoadSessionOptions = {}): Promise<SegmentSession> {
  const { onProgress, modelBuffer, loaderOptions, __useStubSession } = opts

  const buffer =
    modelBuffer ??
    (await loadModel({
      ...loaderOptions,
      onProgress,
    }))

  onProgress?.('init', 1, 1)
  if (__useStubSession) return new StubSession(buffer)
  return createOrtSession(buffer, {
    forceBackend: opts.forceBackend,
  })
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
    const data = new Uint8ClampedArray(width * height * 4)
    // RGB = 255 (white foreground), A = 255 (fully opaque). T10's
    // OrtSession produces a real per-pixel alpha mask.
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = 255
      data[i * 4 + 1] = 255
      data[i * 4 + 2] = 255
      data[i * 4 + 3] = 255
    }
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

export interface ForegroundResult {
  /** RGBA buffer: `applyAlphaMatteToImageData` already applied. */
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface ProcessForegroundOptions {
  /** Long-side cap in pixels. Defaults to {@link DEFAULT_FOREGROUND_MAX_LONGSIDE}. */
  maxLongSide?: number
}

/**
 * Worker-side foreground builder: draws the original `bitmap` and the
 * `mask` (resampled if needed) at the capped working size, then runs
 * `applyAlphaMatteToImageData` so the main thread can skip the heavy
 * pixel passes.
 *
 * Only runs inside contexts that expose `OffscreenCanvas` + `ImageData`
 * (Dedicated workers, and modern main threads). Returns `null` when
 * those globals are absent so the caller falls back to the main-thread
 * implementation.
 */
export async function processForeground(
  bitmap: ImageBitmap,
  mask: MaskBuffer,
  opts: ProcessForegroundOptions = {},
): Promise<ForegroundResult | null> {
  if (typeof OffscreenCanvas === 'undefined' || typeof ImageData === 'undefined') {
    return null
  }

  const maxLongSide = Math.max(1, Math.floor(opts.maxLongSide ?? DEFAULT_FOREGROUND_MAX_LONGSIDE))
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > maxLongSide ? maxLongSide / longest : 1
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const orig = new OffscreenCanvas(w, h)
  const origCtx = orig.getContext('2d')
  if (!origCtx) return null
  origCtx.imageSmoothingEnabled = true
  origCtx.imageSmoothingQuality = 'high'
  origCtx.drawImage(bitmap, 0, 0, w, h)
  const origImage = origCtx.getImageData(0, 0, w, h)

  let maskBuffer: Uint8ClampedArray
  if (mask.width === w && mask.height === h) {
    maskBuffer = mask.data
  } else {
    const maskSrc = new OffscreenCanvas(mask.width, mask.height)
    const maskSrcCtx = maskSrc.getContext('2d')
    if (!maskSrcCtx) return null
    maskSrcCtx.putImageData(new ImageData(mask.data, mask.width, mask.height), 0, 0)

    const maskDst = new OffscreenCanvas(w, h)
    const maskDstCtx = maskDst.getContext('2d')
    if (!maskDstCtx) return null
    maskDstCtx.imageSmoothingEnabled = true
    maskDstCtx.imageSmoothingQuality = 'high'
    maskDstCtx.drawImage(maskSrc, 0, 0, w, h)
    maskBuffer = maskDstCtx.getImageData(0, 0, w, h).data
  }

  applyAlphaMatteToImageData(origImage.data, maskBuffer, w, h, origImage.data)

  return { data: origImage.data, width: w, height: h }
}

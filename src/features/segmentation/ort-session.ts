/**
 * Concrete onnxruntime-web-backed `SegmentSession` implementation.
 *
 * Wraps:
 *   - WebGPU adapter probing → falls back to WASM when unavailable
 *   - Lazy `import('onnxruntime-web/webgpu')` so the runtime never lands
 *     in the main-thread bundle
 *   - Pre/postprocess from T08/T09
 *
 * Lives in segment-core's "loadSession" path; when a `modelBuffer` is
 * injected via test seam, a StubSession is used instead.
 */

import { postprocessMask } from './postprocess'
import { MODEL_SIZE, preprocessBitmap } from './preprocess'
import { ORT_BASE_URL } from './runtime-config'
import type { MaskBuffer, SegmentSession } from './segment-core'
import type { Backend } from './worker-protocol'

/**
 * Pinned subset of the onnxruntime-web API we depend on. Keeps the rest
 * of the codebase free from a hard import of the 2.5 MB ort.mjs.
 */
type OrtTensorCtor = new (type: 'float32', data: Float32Array, dims: readonly number[]) => unknown
interface OrtTensor {
  data: Float32Array | Uint8Array
}
interface OrtInferenceSession {
  inputNames: string[]
  outputNames: string[]
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>
  release?: () => Promise<void>
}
interface OrtModule {
  Tensor: OrtTensorCtor
  InferenceSession: {
    create(buffer: ArrayBuffer, options?: Record<string, unknown>): Promise<OrtInferenceSession>
  }
  env: {
    wasm: { wasmPaths?: string; numThreads?: number; simd?: boolean }
  }
}

let ortPromise: Promise<OrtModule> | null = null

/**
 * Lazy-load onnxruntime-web. Importing the `/webgpu` entry pulls in the
 * JSEP runtime (WebGPU via wasm), and ORT itself decides at session-
 * creation time whether to engage the WebGPU EP or fall back to wasm.
 */
function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = // The dynamic import path is a literal string; bundlers split it
    // into its own chunk. Cast through unknown to satisfy our local
    // structural type.
    (import('onnxruntime-web/webgpu') as Promise<unknown>).then((mod) => {
      const ort = mod as OrtModule
      ort.env.wasm.wasmPaths = ORT_BASE_URL
      return ort
    })
  }
  return ortPromise
}

/** Reset the cached module — only used in unit tests. */
export function __resetOrtCache(): void {
  ortPromise = null
}

/** Inject a test double for the onnxruntime-web module. */
export function __setOrtForTesting(mod: OrtModule | null): void {
  ortPromise = mod ? Promise.resolve(mod) : null
}

/**
 * Probe WebGPU availability without touching ort. We do this once at
 * createOrtSession time so the decision is cheap and observable in
 * tests.
 */
export async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }
  if (!nav.gpu) return false
  try {
    const adapter = await nav.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

const MAX_INIT_ATTEMPTS = 2

interface CreateOrtSessionOptions {
  /** Force a specific backend (used by tests and the wasm-only retry path). */
  forceBackend?: Backend
}

/**
 * Construct an OrtSession from a verified model ArrayBuffer.
 *
 * Tries WebGPU when supported, transparently falls back to WASM on
 * session-create failure. The wasm path is the last resort — if it also
 * fails, the error is propagated up.
 */
export async function createOrtSession(
  modelBuffer: ArrayBuffer,
  options: CreateOrtSessionOptions = {},
): Promise<SegmentSession> {
  const ort = await loadOrt()
  const wantGpu = options.forceBackend ? options.forceBackend === 'webgpu' : await hasWebGPU()

  const order: Backend[] = wantGpu ? ['webgpu', 'wasm'] : ['wasm']
  let lastErr: unknown
  for (const backend of order) {
    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
      try {
        const session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: backend === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
          graphOptimizationLevel: 'all',
        })
        return new OrtSession(ort, session, backend)
      } catch (err) {
        lastErr = err
        // Trying again with the same backend has rarely helped in practice;
        // keep it short and move on quickly.
        if (attempt === MAX_INIT_ATTEMPTS) break
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`InferenceSession.create failed: ${String(lastErr)}`)
}

class OrtSession implements SegmentSession {
  constructor(
    private readonly ort: OrtModule,
    private readonly session: OrtInferenceSession,
    public readonly backend: Backend,
  ) {}

  async run(bitmap: ImageBitmap): Promise<MaskBuffer> {
    const inputName = this.session.inputNames[0]
    const outputName = this.session.outputNames[0]
    if (!inputName || !outputName) {
      throw new Error('OrtSession: model does not expose input/output names')
    }

    const { tensor, shape, origWidth, origHeight, crop } = await preprocessBitmap(
      bitmap,
      MODEL_SIZE,
    )

    const inputTensor = new this.ort.Tensor('float32', tensor, shape as readonly number[])
    const outputs = await this.session.run({ [inputName]: inputTensor })
    const raw = outputs[outputName]
    if (!raw) {
      throw new Error(`OrtSession: missing output "${outputName}" in results`)
    }
    const outputData = raw.data
    if (!(outputData instanceof Float32Array)) {
      throw new Error(`OrtSession: expected Float32 output, got ${outputData.constructor.name}`)
    }

    const image = postprocessMask(outputData, origWidth, origHeight, crop, MODEL_SIZE)
    return { data: image.data, width: image.width, height: image.height }
  }
}

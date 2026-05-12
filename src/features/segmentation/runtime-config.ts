/**
 * Runtime configuration for the in-browser segmentation pipeline.
 *
 * This module is intentionally **pure data** — it does NOT import
 * onnxruntime-web. The whole 2.5 MB ort.mjs runtime only lives inside the
 * Web Worker chunk (see segmentation.worker.ts in M2-T06). Main thread
 * code can safely depend on this module without bloating the home page.
 *
 * Model registry
 * --------------
 * Pixfit ships two MODNet ONNX variants:
 *
 *   - `modnet-fp16` (~13 MB, half precision) — default since M9. Same
 *     architecture as the INT8 build but keeps full float dynamic range
 *     in the alpha matte, which removes the quantization "speckle" that
 *     showed up on dark hair and dark clothing in M2 user testing.
 *   - `modnet-int8` (~6.6 MB, INT8 quantized) — kept as a fallback for
 *     bandwidth-constrained environments. The M2 default; quality is
 *     lower at hair edges and on dark / saturated subjects.
 *
 * Both variants share the same preprocess / postprocess pipeline
 * (1×3×512×512 float32 input, 1×1×512×512 float32 alpha output), so the
 * worker is agnostic to which one is selected.
 *
 * Override paths
 * --------------
 * - `NEXT_PUBLIC_SEG_MODEL` — variant id (`modnet-fp16` | `modnet-int8`),
 *   defaults to `modnet-fp16`. Used to roll back to INT8 without
 *   redeploy.
 * - `NEXT_PUBLIC_MODEL_URL` — fully qualified URL that bypasses the
 *   registry's `path` (e.g. when serving from cdn.pix-fit.com). The
 *   matching SHA-384 from the chosen variant is still enforced.
 * - `NEXT_PUBLIC_ORT_BASE_URL` — alternative base for the
 *   onnxruntime-web wasm side files.
 */

import packageJson from '../../../package.json'

/**
 * onnxruntime-web's pinned version, sourced from package.json. We use it
 * to build a default CDN URL so a `pnpm update` automatically propagates
 * to the wasm asset URLs.
 */
const ORT_VERSION = (packageJson.dependencies['onnxruntime-web'] ?? '').replace(/^[\^~]/, '')

/**
 * Base URL for the WASM / .mjs side files that onnxruntime-web fetches at
 * inference time (`ort-wasm-simd-threaded.wasm`, `.jsep.wasm`, etc).
 *
 * Default: jsDelivr CDN pinned to the installed version. Override with
 * NEXT_PUBLIC_ORT_BASE_URL=https://cdn.pix-fit.com/ort/<version>/
 * when self-hosting.
 */
export const ORT_BASE_URL =
  process.env.NEXT_PUBLIC_ORT_BASE_URL ??
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION || 'latest'}/dist/`

/**
 * Canonical id for one of the segmentation models Pixfit ships.
 *
 * Adding a new variant: bump this union, register the entry in
 * MODEL_VARIANTS, run `pnpm models:fetch --variant <id>`, paste the
 * printed `sha384-...` into `sha384`.
 */
export type SegModelId = 'modnet-fp16' | 'modnet-int8'

export interface SegModelVariant {
  /** Stable id, also used for the `NEXT_PUBLIC_SEG_MODEL` env override. */
  readonly id: SegModelId
  /**
   * Local filename relative to the static asset root. The runtime URL
   * is `${origin}/_models/${path}` unless overridden by
   * NEXT_PUBLIC_MODEL_URL.
   */
  readonly path: string
  /**
   * Where `pnpm models:fetch` pulls the binary from. ModelScope first
   * (works inside mainland China), Hugging Face as a fallback. The
   * runtime fetch always goes through `path` — these URLs are only
   * consumed by scripts/fetch-model.mjs.
   */
  readonly sources: readonly string[]
  /** Expected SHA-384 of the on-disk binary, for SRI verification. */
  readonly sha384: string
  /** Approximate uncompressed size (used by docs / progress UI). */
  readonly approxBytes: number
  /** Human-readable summary shown in PLAN.md and decision logs. */
  readonly description: string
}

export const MODEL_VARIANTS: Readonly<Record<SegModelId, SegModelVariant>> = {
  'modnet-fp16': {
    id: 'modnet-fp16',
    path: 'modnet.fp16.onnx',
    sha384: 'sha384-RYJYlGztzT2Gd1qUlOhsxJfqRK6CT2GKFmE8yBkoy4AEae19S84pBZDo6lFbdm6o',
    approxBytes: 12_984_781,
    description: 'MODNet half-precision ONNX, ~13 MB. Recommended default.',
    sources: [
      'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_fp16.onnx',
      'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_fp16.onnx',
    ],
  },
  'modnet-int8': {
    id: 'modnet-int8',
    path: 'modnet.q.onnx',
    sha384: 'sha384-UR4U6sRE6EBfNeXg13vkxmg0i02TO61xKTTZ8HO0zfrdaffLJN17ZuC8/iivopZA',
    approxBytes: 6_628_864,
    description: 'MODNet INT8 quantized ONNX, ~6.6 MB. Bandwidth fallback.',
    sources: [
      'https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx',
      'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx',
    ],
  },
} as const

export const DEFAULT_SEG_MODEL: SegModelId = 'modnet-fp16'

function resolveVariant(raw: string | undefined): SegModelVariant {
  if (raw && raw in MODEL_VARIANTS) {
    return MODEL_VARIANTS[raw as SegModelId]
  }
  return MODEL_VARIANTS[DEFAULT_SEG_MODEL]
}

/**
 * The variant active in this build, picked from
 * `NEXT_PUBLIC_SEG_MODEL` or the default.
 *
 * Read once at module load — Next.js inlines `process.env.NEXT_PUBLIC_*`
 * at build time, so this is a constant from the runtime's POV.
 */
export const MODEL_VARIANT: SegModelVariant = resolveVariant(process.env.NEXT_PUBLIC_SEG_MODEL)

/**
 * Where the active MODNet ONNX file lives at runtime.
 *
 * Default: `/_models/<path>` — served as a Next.js static asset from
 * `public/_models/` (or its Cloudflare equivalent in production).
 * Override with NEXT_PUBLIC_MODEL_URL=https://cdn.pix-fit.com/models/...
 * once R2 is wired up.
 */
export const MODEL_URL = process.env.NEXT_PUBLIC_MODEL_URL ?? `/_models/${MODEL_VARIANT.path}`

/**
 * SHA-384 expected for the currently active variant. Re-exported from
 * here so callers don't need to import the registry — they can keep
 * doing `import { MODEL_SHA384 } from './integrity'`.
 */
export const MODEL_SHA384 = MODEL_VARIANT.sha384

/**
 * Local development hint — used by the model loader to decide whether
 * a network error means "user is offline" or "infra issue".
 */
export const IS_DEV = process.env.NODE_ENV !== 'production'

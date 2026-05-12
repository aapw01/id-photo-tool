/**
 * Runtime configuration for the in-browser segmentation pipeline.
 *
 * This module is intentionally **pure data** — it does NOT import
 * onnxruntime-web. The whole 2.5 MB ort.mjs runtime only lives inside the
 * Web Worker chunk (see segmentation.worker.ts in M2-T06). Main thread
 * code can safely depend on this module without bloating the home page.
 *
 * All paths are overridable via `NEXT_PUBLIC_*` env vars so we can swap
 * to Cloudflare R2 (cdn.pix-fit.com) at deploy time without code changes.
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
 * Where the MODNet ONNX file lives at runtime.
 *
 * Default: `/_models/modnet.q.onnx` — served as a Next.js static asset
 * from `public/_models/` (or its Cloudflare equivalent in production).
 * Override with NEXT_PUBLIC_MODEL_URL=https://cdn.pix-fit.com/models/modnet.q.onnx
 * once R2 is wired up (see TODO §1.1).
 */
export const MODEL_URL = process.env.NEXT_PUBLIC_MODEL_URL ?? '/_models/modnet.q.onnx'

/**
 * Local development hint — used by the model loader to decide whether
 * a network error means "user is offline" or "infra issue".
 */
export const IS_DEV = process.env.NODE_ENV !== 'production'

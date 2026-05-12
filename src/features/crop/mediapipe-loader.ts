/**
 * MediaPipe Tasks Vision lazy loader.
 *
 * Wraps `FaceDetector.createFromOptions` so the heavy WASM bundle
 * (~2 MB) and the BlazeFace model (~230 KB) are deferred until the
 * user actually opens the size tab in Studio.
 *
 * Resource policy (parallel to onnxruntime-web in M2):
 *
 *   - WASM      → jsdelivr CDN. Pinned by version match with the
 *                 installed `@mediapipe/tasks-vision` package; pinned
 *                 to `latest` would risk silent breakage.
 *   - Model     → Google Cloud Storage (the URL MediaPipe themselves
 *                 publish). Small (≈230 KB), CDN-cached, browser
 *                 caches handle redownloads.
 *
 * Both URLs are overridable via env vars so we can flip everything to
 * `cdn.pix-fit.com` once Cloudflare is provisioned (M2-T03).
 */

import type { FaceDetector } from '@mediapipe/tasks-vision'

import packageJson from '../../../package.json'

import { silenceMediaPipeBootNoise } from './silence-mediapipe-noise'

/**
 * MediaPipe Tasks Vision pinned version, sourced from package.json so
 * a `pnpm update` automatically rolls the CDN URL forward. Mirrors the
 * pattern in `src/features/segmentation/runtime-config.ts:44` for
 * onnxruntime-web.
 */
const MEDIAPIPE_VERSION = (packageJson.dependencies['@mediapipe/tasks-vision'] ?? '').replace(
  /^[\^~]/,
  '',
)

const DEFAULT_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION || 'latest'}/wasm`

const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

function envOr(key: string, fallback: string): string {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string
  }
  return fallback
}

export const MEDIAPIPE_WASM_BASE = envOr('NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL', DEFAULT_WASM_BASE)
export const FACE_MODEL_URL = envOr('NEXT_PUBLIC_FACE_MODEL_URL', DEFAULT_MODEL_URL)

let detectorPromise: Promise<FaceDetector> | null = null

type TasksVisionModule = typeof import('@mediapipe/tasks-vision')
let cachedModule: TasksVisionModule | null = null
async function loadModule(): Promise<TasksVisionModule> {
  if (!cachedModule) {
    cachedModule = await import('@mediapipe/tasks-vision')
  }
  return cachedModule
}

/**
 * Lazily create (or reuse) the singleton FaceDetector. Detection
 * config tuned for portraits: a single face, short-range model,
 * confidence ≥ 0.5 to keep noisy backgrounds from spawning ghosts.
 */
export async function getFaceDetector(): Promise<FaceDetector> {
  if (detectorPromise) return detectorPromise

  // Wasm boot logs fire on the next `detect()` call; install the
  // console filter before that happens so dev-terminal noise stays
  // out of the user's stack-trace surface.
  silenceMediaPipeBootNoise()

  detectorPromise = (async () => {
    const { FaceDetector: Cls, FilesetResolver } = await loadModule()
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE)
    return Cls.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
      // We only ever need the most prominent face for a portrait.
      // (The SDK doesn't expose a single-face flag; the default is
      // already small enough not to matter.)
    })
  })()

  try {
    return await detectorPromise
  } catch (err) {
    detectorPromise = null
    throw err
  }
}

/** Test-only seam: reset the singleton between tests. */
export function __resetFaceDetectorForTesting(): void {
  detectorPromise = null
  cachedModule = null
}

/** Test-only seam: inject a fake module so tests don't load WASM. */
export function __setTasksVisionModuleForTesting(mod: TasksVisionModule | null): void {
  cachedModule = mod
  detectorPromise = null
}

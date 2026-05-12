'use client'

/**
 * Single-shot face detection for the Studio crop tab.
 *
 * Hides the MediaPipe API surface and produces the small, stable
 * `FaceDetection` payload the rest of the crop pipeline (auto-center,
 * compliance, guidelines) consumes. Coordinates are returned in *image
 * pixels*, not normalized 0–1.
 *
 * Errors are classified into:
 *   - `model-fetch`  failure to download WASM or tflite
 *   - `runtime`      crash during `.detect()`
 *   - `no-face`      detector ran but found nothing of confidence
 */

import type { FaceDetector } from '@mediapipe/tasks-vision'

import type { FaceDetection } from '@/types/spec'

import { getFaceDetector } from './mediapipe-loader'

export type FaceDetectErrorKind = 'model-fetch' | 'runtime' | 'no-face' | 'unknown'

export class FaceDetectError extends Error {
  readonly kind: FaceDetectErrorKind
  constructor(kind: FaceDetectErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FaceDetectError'
    this.kind = kind
  }
}

/**
 * Detect the most prominent face in `bitmap`. Returns `null` when the
 * detector ran successfully but did not find a face — callers should
 * treat that as "fall back to centred-crop", not as an error.
 */
export async function detectFace(bitmap: ImageBitmap): Promise<FaceDetection | null> {
  let detector: FaceDetector
  try {
    detector = await getFaceDetector()
  } catch (err) {
    throw new FaceDetectError('model-fetch', stringifyError(err), { cause: err })
  }

  let result: ReturnType<FaceDetector['detect']>
  try {
    result = detector.detect(bitmap)
  } catch (err) {
    throw new FaceDetectError('runtime', stringifyError(err), { cause: err })
  }

  const detections = result?.detections ?? []
  if (detections.length === 0) return null

  // Pick the largest bounding box (== closest face).
  const best = detections.reduce((acc, det) => {
    const aArea = acc.boundingBox ? acc.boundingBox.width * acc.boundingBox.height : 0
    const bArea = det.boundingBox ? det.boundingBox.width * det.boundingBox.height : 0
    return bArea > aArea ? det : acc
  })

  if (!best.boundingBox) return null
  const bbox = {
    x: best.boundingBox.originX,
    y: best.boundingBox.originY,
    w: best.boundingBox.width,
    h: best.boundingBox.height,
  }

  // MediaPipe returns keypoints normalised to [0, 1] — but only on
  // some builds. To stay defensive, treat values <= 1 as normalised
  // and scale by image dimensions.
  const W = bitmap.width
  const H = bitmap.height
  const keypoints = (best.keypoints ?? []).map((k) => ({
    x: k.x <= 1 ? k.x * W : k.x,
    y: k.y <= 1 ? k.y * H : k.y,
  }))

  const confidence = best.categories?.[0]?.score ?? 0

  return { bbox, keypoints, confidence }
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

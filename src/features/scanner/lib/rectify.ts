'use client'

/**
 * Top-level "scan" pipeline: takes a decoded `ImageBitmap`, returns
 * a perspective-corrected `Blob` matching the target `DocSpec`.
 *
 * Caller hands us a `quad` to override the auto-detection (used by
 * the manual corner editor in `scanner-corner-editor.tsx` to re-warp
 * after the user drags a handle).
 *
 * Worker-first: both `detectCorners` and `warpPerspective` route to
 * the OpenCV Web Worker (see `opencv-worker-client.ts`); this module
 * stays a thin orchestration layer that owns neither the OpenCV
 * runtime nor any DOM, so it remains unit-testable headlessly by
 * mocking the worker client.
 */

import { detectCorners, type DetectCornersResult, type Quad } from './detect-corners'
import { warpPerspective } from './warp-perspective'
import { getOutputPixels, type DocSpec } from './doc-specs'

export interface RectifyOptions {
  bitmap: ImageBitmap
  spec: DocSpec
  /** Optional override — bypasses auto-detection when provided. */
  quad?: Quad
  /** Output DPI; defaults to 300. */
  dpi?: number
  /** Output MIME; defaults to image/png (lossless). */
  mime?: string
}

export interface RectifyResult {
  blob: Blob
  width: number
  height: number
  quad: Quad
  /** Whether the corners came from auto-detection (false ⇒ fallback or override). */
  detected: boolean
}

export async function rectifyDocument(options: RectifyOptions): Promise<RectifyResult> {
  const { bitmap, spec, quad, dpi = 300, mime = 'image/png' } = options
  const detection: DetectCornersResult = quad
    ? { quad, detected: false }
    : await detectCorners(bitmap)
  const output = getOutputPixels(spec, dpi)
  const warped = await warpPerspective(bitmap, detection.quad, {
    outputWidth: output.width,
    outputHeight: output.height,
    mime,
  })
  return {
    blob: warped.blob,
    width: warped.width,
    height: warped.height,
    quad: detection.quad,
    detected: detection.detected,
  }
}

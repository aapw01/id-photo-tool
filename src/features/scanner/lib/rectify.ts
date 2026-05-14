'use client'

/**
 * Top-level "scan" pipeline: takes a decoded `ImageBitmap`, returns
 * a perspective-corrected `Blob` matching the target `DocSpec`.
 *
 * Quad sourcing:
 *
 *   - If the caller passes `quad`, we warp using exactly those
 *     corners. This is the normal path after the user has dragged
 *     the 4-corner editor.
 *
 *   - If no `quad` is supplied, we fall back to `defaultQuad` — a
 *     centered, slightly inset rectangle. This produces a usable
 *     first preview the moment the user uploads an image, which the
 *     user can refine via the corner editor.
 *
 * No auto-detection: the OpenCV.js-backed corner detector was
 * retired (see comment in `detect-corners.ts`). The pure-JS warp
 * kernel + manual editor cover the same ground without the 10 MB
 * runtime cost.
 */

import { defaultQuad, type Quad } from './detect-corners'
import { warpPerspective } from './warp-perspective'
import { getOutputPixels, type DocSpec } from './doc-specs'

export interface RectifyOptions {
  bitmap: ImageBitmap
  spec: DocSpec
  /** Optional override — bypasses the default quad when provided. */
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
  /**
   * Always `false` after the OpenCV.js-backed auto-detector was
   * retired — kept on the result for downstream API stability so
   * callers (history store, tests) don't need a coordinated change.
   */
  detected: boolean
}

export async function rectifyDocument(options: RectifyOptions): Promise<RectifyResult> {
  const { bitmap, spec, quad, dpi = 300, mime = 'image/png' } = options
  const finalQuad = quad ?? defaultQuad(bitmap.width, bitmap.height, spec.widthMm / spec.heightMm)
  const output = getOutputPixels(spec, dpi)
  const warped = await warpPerspective(bitmap, finalQuad, {
    outputWidth: output.width,
    outputHeight: output.height,
    mime,
  })
  return {
    blob: warped.blob,
    width: warped.width,
    height: warped.height,
    quad: finalQuad,
    detected: false,
  }
}

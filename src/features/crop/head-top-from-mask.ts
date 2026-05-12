/**
 * Pixel-accurate head-top detection from a foreground alpha mask.
 *
 * BlazeFace's keypoint-derived "forehead" lands at the hairline and
 * the bbox top stops near the eyebrows — neither one covers hair.
 * Heuristics (`bbox.y − bbox.h × 0.18`) work for typical short hair
 * but fail on buns, ponytails, hats, and high curls.
 *
 * MODNet's alpha mask already knows where the subject's silhouette
 * sits at every pixel, so a top-down scan trivially finds the
 * highest visible point — no estimation involved.
 *
 * The scan is constrained horizontally to the face bbox (with a
 * symmetric expansion) so accessories on the body — earphone cables,
 * shoulders, lifted hands — can't be mis-identified as the head.
 * Returns `null` when no row qualifies (mask empty, scan window
 * outside the mask, etc.). Callers should fall back to the heuristic.
 */

import type { FaceDetection } from '@/types/spec'

export interface HeadTopFromMaskOptions {
  /** Minimum alpha (0–255) for a pixel to count as foreground. */
  threshold?: number
  /** Minimum opaque pixels in a row before we call it the head top. */
  minPixels?: number
  /**
   * Expand the face-bbox horizontal scan window by this fraction of
   * the bbox width on each side. Hair can flare wider than the face
   * itself (e.g. afros, long side-swept fringes), so 50 % on each
   * side has been the safest default in our test corpus.
   */
  bboxExpand?: number
}

const DEFAULTS = {
  threshold: 32,
  minPixels: 3,
  bboxExpand: 0.5,
} satisfies Required<HeadTopFromMaskOptions>

export function findHeadTopFromMask(
  mask: ImageData,
  imageWidth: number,
  imageHeight: number,
  face: FaceDetection | null,
  options: HeadTopFromMaskOptions = {},
): number | null {
  const threshold = options.threshold ?? DEFAULTS.threshold
  const minPixels = options.minPixels ?? DEFAULTS.minPixels
  const bboxExpand = options.bboxExpand ?? DEFAULTS.bboxExpand

  const maskW = mask.width
  const maskH = mask.height
  if (maskW <= 0 || maskH <= 0) return null

  const data = mask.data

  // The mask may be downscaled relative to the source image. Scale x
  // through the mask grid, scale y back to image-pixel space.
  const xScale = maskW / imageWidth
  const yScale = imageHeight / maskH

  let x0 = 0
  let x1 = maskW - 1
  if (face) {
    const pad = face.bbox.w * bboxExpand
    const minX = face.bbox.x - pad
    const maxX = face.bbox.x + face.bbox.w + pad
    x0 = Math.max(0, Math.floor(minX * xScale))
    x1 = Math.min(maskW - 1, Math.ceil(maxX * xScale))
  }
  if (x1 < x0) return null

  for (let y = 0; y < maskH; y++) {
    let count = 0
    let offset = (y * maskW + x0) * 4 + 3 // alpha channel
    for (let x = x0; x <= x1; x++) {
      if ((data[offset] ?? 0) >= threshold) {
        count++
        if (count >= minPixels) {
          // Convert mask y back to image-pixel y. Use the row's
          // *top* so the resulting value is the highest visible
          // point of the subject, not the centre of the row.
          return y * yScale
        }
      }
      offset += 4
    }
  }

  return null
}

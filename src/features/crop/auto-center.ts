/**
 * Auto-center algorithm — given an image, a target PhotoSpec, and an
 * optional face detection, return the rectangle to crop so the head
 * sits in the right place according to the spec's composition rule.
 *
 * Rules of thumb (TECH_DESIGN §5.4.2):
 *
 *   1. Estimate head height (chin → forehead) from MediaPipe keypoints.
 *   2. Frame height = head_height / targetHeadRatio.
 *   3. Frame width  = frame_height × spec.aspect.
 *   4. Frame top    = eyeY − frame_height × eyeFromTopRatio.
 *   5. Frame left   = headCenterX − frame_width / 2.
 *   6. Clamp the frame into the image bounds. If the spec aspect
 *      forces the frame to overflow even after clamping, scale down.
 *
 * Pure, deterministic, allocation-free. Easy to unit test.
 */

import type { CropFrame, FaceDetection, PhotoSpec } from '@/types/spec'

import { aspectRatio } from '@/lib/spec-units'

interface ImageSize {
  width: number
  height: number
}

const DEFAULT_HEAD_RATIO = 0.65
const DEFAULT_EYE_FROM_TOP = 0.38

const MIDPOINT = <T>(a: [T, T] | undefined): number | undefined => {
  if (!a) return undefined
  return (Number(a[0]) + Number(a[1])) / 2
}

/**
 * Estimate the chin and forehead Y-coordinates given MediaPipe's
 * keypoints. The detector emits 6 points; we use the eyes (0, 1) +
 * mouth (3) to triangulate.
 *
 * Approximations:
 *   - eyeY    = average of left/right eye Y
 *   - eyeToChin     ≈ 1.7 × mouth-to-eye distance
 *   - eyeToForehead ≈ 1.5 × mouth-to-eye distance
 *
 * These coefficients come from the canonical "five-eye, three-fifths"
 * face proportions used by portrait artists.
 */
export function estimateHeadVerticalSpan(face: FaceDetection): {
  eyeY: number
  chinY: number
  foreheadY: number
  headCenterX: number
} {
  const eyeL = face.keypoints[0]
  const eyeR = face.keypoints[1]
  const mouth = face.keypoints[3]

  // Fall back to the bbox when keypoints are missing.
  if (!eyeL || !eyeR || !mouth) {
    const cx = face.bbox.x + face.bbox.w / 2
    const top = face.bbox.y
    const bot = face.bbox.y + face.bbox.h
    return {
      eyeY: top + face.bbox.h * 0.42,
      foreheadY: top,
      chinY: bot,
      headCenterX: cx,
    }
  }

  const eyeY = (eyeL.y + eyeR.y) / 2
  const eyeToMouth = mouth.y - eyeY
  const chinY = eyeY + 1.7 * eyeToMouth
  const foreheadY = eyeY - 1.5 * eyeToMouth
  const headCenterX = (eyeL.x + eyeR.x) / 2

  return { eyeY, chinY, foreheadY, headCenterX }
}

/**
 * Produce the crop frame for a given spec on a given image.
 *
 * If `face` is non-null, the head is placed per the spec's composition
 * rule. If null, falls back to a centred crop covering the largest
 * area that still respects the spec aspect ratio.
 */
export function autoCenter(
  image: ImageSize,
  spec: PhotoSpec,
  face: FaceDetection | null,
): CropFrame {
  const aspect = aspectRatio(spec)
  if (!face) {
    return centerCrop(image, aspect)
  }

  const { eyeY, chinY, foreheadY, headCenterX } = estimateHeadVerticalSpan(face)
  const headHeight = Math.max(1, foreheadY - chinY < 0 ? chinY - foreheadY : foreheadY - chinY)
  // NB: forehead is *above* chin in image-pixel space, so foreheadY < chinY.
  // The Math.max above keeps us robust to unusual key-point orderings.

  const targetHeadRatio = MIDPOINT(spec.composition?.headHeightRatio) ?? DEFAULT_HEAD_RATIO
  const eyeFromTopRatio = MIDPOINT(spec.composition?.eyeLineFromTop) ?? DEFAULT_EYE_FROM_TOP

  let frameH = headHeight / targetHeadRatio
  let frameW = frameH * aspect

  // The natural frame might be wider or taller than the image. If so,
  // shrink uniformly to the image bounds while keeping the aspect.
  if (frameW > image.width) {
    const scale = image.width / frameW
    frameW = image.width
    frameH *= scale
  }
  if (frameH > image.height) {
    const scale = image.height / frameH
    frameH = image.height
    frameW *= scale
  }

  let top = eyeY - frameH * eyeFromTopRatio
  let left = headCenterX - frameW / 2

  // Clamp into image bounds without changing size — that would shift
  // the head off-target. The eye position lands within the allowed
  // band even after clamping for most real portraits.
  if (left < 0) left = 0
  if (left + frameW > image.width) left = image.width - frameW
  if (top < 0) top = 0
  if (top + frameH > image.height) top = image.height - frameH

  return { x: left, y: top, w: frameW, h: frameH }
}

/**
 * Centred crop covering the largest area that satisfies `aspect`.
 * Used when face detection has nothing to offer.
 */
export function centerCrop(image: ImageSize, aspect: number): CropFrame {
  const imageAspect = image.width / image.height
  let w: number
  let h: number
  if (imageAspect > aspect) {
    // Image is wider → height-limited
    h = image.height
    w = h * aspect
  } else {
    w = image.width
    h = w / aspect
  }
  return {
    x: (image.width - w) / 2,
    y: (image.height - h) / 2,
    w,
    h,
  }
}

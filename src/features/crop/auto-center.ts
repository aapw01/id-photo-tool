/**
 * Auto-center algorithm — given an image, a target PhotoSpec, and an
 * optional face detection, return the rectangle to crop so the head
 * sits in the right place according to the spec's composition rule.
 *
 * Pure, deterministic, allocation-free. Easy to unit test.
 *
 * Rules of thumb (TECH_DESIGN §5.4.2):
 *
 *   1. Estimate head height (chin → forehead, hair-inclusive). When
 *      the caller provides `hints.headTopY` — typically derived from
 *      MODNet's alpha mask — use it directly: that's the most
 *      accurate signal available. Otherwise fall back to a heuristic
 *      blend of MediaPipe keypoints and the detector bbox: keypoints
 *      give a forehead/hairline (`eyeY − 1.5 × eyeToMouth`); the
 *      detector bbox caps near the eyebrows, so we extrapolate with
 *      `bbox.y − bbox.h × 0.18` and pick whichever sits higher. The
 *      result is still hair-aware but error-prone on tall hairdos /
 *      hats — feeding the mask whenever it's available is preferred.
 *
 *   2. Frame height = head_height / targetHeadRatio. The legal head
 *      share of the frame lives in `spec.composition.headHeightRatio`
 *      as a band `[lower, upper]`. We pick a value inside the band
 *      based on `hints.headSizeBias` (0 = lower, 1 = upper, default
 *      0.5 = mid). Smaller head ratio ⇒ bigger frame ⇒ more padding
 *      around the head; larger ⇒ tighter frame, head fills more of
 *      the photo. The UI surfaces this as a slider so the user can
 *      pick the look they want.
 *
 *   3. Frame width  = frame_height × spec.aspect.
 *
 *   4. Frame top    = eyeY − frame_height × eyeFromTopRatio. If this
 *      would slice into the hair (head-top sits within 4 % of the
 *      frame top), grow `frame_height` first so the hair has
 *      breathing room.
 *
 *   5. Frame left   = headCenterX − frame_width / 2.
 *
 *   6. Clamp the frame into the image bounds. If the spec aspect
 *      forces the frame to overflow even after clamping, scale down.
 */

import type { CropFrame, FaceDetection, PhotoSpec } from '@/types/spec'

import { aspectRatio } from '@/lib/spec-units'

interface ImageSize {
  width: number
  height: number
}

const DEFAULT_HEAD_RATIO = 0.7
const DEFAULT_EYE_FROM_TOP = 0.38

// Conservative hair allowance expressed as a fraction of the face
// detector bbox height. BlazeFace's bbox typically caps around the
// eyebrows, so ~18 % above the bbox top covers short-to-medium hair on
// most subjects without venturing too far into background pixels.
const HAIR_ALLOWANCE_RATIO = 0.18

// Minimum vertical clearance between the estimated head-top and the
// frame top, expressed as a fraction of the frame height. Keeps the
// hair from rendering flush with the crop edge.
const TOP_PADDING_RATIO = 0.04

const MIDPOINT = <T>(a: [T, T] | undefined): number | undefined => {
  if (!a) return undefined
  return (Number(a[0]) + Number(a[1])) / 2
}

/**
 * Pick a point inside `[lower, upper]` weighted by `bias ∈ [0, 1]`.
 * `bias = 0` returns `lower`, `bias = 1` returns `upper`, `bias = 0.5`
 * returns the midpoint. Used to honour the user's head-size slider
 * choice within the spec's allowed band.
 */
const LERP_IN_BAND = (a: [number, number] | undefined, bias: number): number | undefined => {
  if (!a) return undefined
  const b = clamp01(bias)
  return Number(a[0]) * (1 - b) + Number(a[1]) * b
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Optional hints that take precedence over the keypoint-only
 * heuristics inside `autoCenter`. The most useful one is
 * `headTopY` — when MODNet has already been run, the mask gives
 * pixel-accurate head-top (hair included), removing all of the
 * estimation error inherent in BlazeFace's keypoints + bbox.
 */
export interface AutoCenterHints {
  /**
   * Image-pixel y of the visible head top (hair included). Overrides
   * the keypoint/bbox heuristic when provided.
   */
  headTopY?: number
  /**
   * Position within `spec.composition.headHeightRatio` band:
   *   0   → use `lower` (head occupies the minimum legal share)
   *   0.5 → midpoint (default)
   *   1   → use `upper` (head fills the maximum legal share)
   */
  headSizeBias?: number
}

/**
 * Estimate the chin and forehead Y-coordinates given MediaPipe's
 * keypoints. The detector emits 6 points; we use the eyes (0, 1) +
 * mouth (3) to triangulate.
 *
 * Approximations:
 *   - eyeY    = average of left/right eye Y
 *   - eyeToChin     ≈ 1.7 × mouth-to-eye distance
 *   - eyeToForehead ≈ 1.5 × mouth-to-eye distance (lands ≈ hairline)
 *
 * These coefficients come from the canonical "five-eye, three-fifths"
 * face proportions used by portrait artists. The keypoint-derived
 * "forehead" excludes hair, so we also derive a second estimate from
 * the detector bbox (`bbox.y − bbox.h × HAIR_ALLOWANCE_RATIO`) and use
 * whichever sits higher up the image — the resulting `foreheadY` then
 * represents the visible head-top (hair included), which is what
 * downstream framing and compliance checks actually care about.
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

  const foreheadFromBbox = face.bbox.y - face.bbox.h * HAIR_ALLOWANCE_RATIO

  // Fall back to the bbox when keypoints are missing.
  if (!eyeL || !eyeR || !mouth) {
    const cx = face.bbox.x + face.bbox.w / 2
    const top = face.bbox.y
    const bot = top + face.bbox.h
    return {
      eyeY: top + face.bbox.h * 0.42,
      // bbox-derived hair allowance: lifts the head-top above the
      // eyebrow-line bbox cap so hair is included.
      foreheadY: foreheadFromBbox,
      chinY: bot,
      headCenterX: cx,
    }
  }

  const eyeY = (eyeL.y + eyeR.y) / 2
  const eyeToMouth = mouth.y - eyeY
  const chinY = eyeY + 1.7 * eyeToMouth
  // Take whichever estimate sits higher (smaller Y) so hair is included.
  const foreheadY = Math.min(eyeY - 1.5 * eyeToMouth, foreheadFromBbox)
  const headCenterX = (eyeL.x + eyeR.x) / 2

  return { eyeY, chinY, foreheadY, headCenterX }
}

/**
 * Produce the crop frame for a given spec on a given image.
 *
 * If `face` is non-null, the head is placed per the spec's composition
 * rule. If null, falls back to a centred crop covering the largest
 * area that still respects the spec aspect ratio.
 *
 * When the head sits close to an image edge, the natural composition
 * would push the frame off the image. Hard-clamping the frame in that
 * case used to jam the head against the edge — the user could no
 * longer drag the frame down because the top was already at `y=0`.
 * Instead, we shrink the frame *uniformly* (preserving the spec
 * aspect ratio) so the head still lands at the spec's intended
 * eye-from-top / centered-X position. The frame ends up smaller, but
 * the head composition is correct.
 *
 * The frame may also need to *grow* before any clamping/shrinking
 * happens: when `estimateHeadVerticalSpan` reports a tall head
 * (lots of hair) and the spec's `eyeFromTopRatio` is small, the
 * natural frame top can land below the hair, leaving the head poking
 * out at the top. We expand `frameH` upfront so the head-top sits at
 * least `TOP_PADDING_RATIO × frameH` below the frame top, then let
 * the existing shrink pass mop up any resulting image-bound
 * overflow.
 */
export function autoCenter(
  image: ImageSize,
  spec: PhotoSpec,
  face: FaceDetection | null,
  hints: AutoCenterHints = {},
): CropFrame {
  const aspect = aspectRatio(spec)
  if (!face) {
    return centerCrop(image, aspect)
  }

  const span = estimateHeadVerticalSpan(face)
  const { eyeY, chinY, headCenterX } = span
  // Prefer the mask-derived head-top when provided — it is pixel
  // accurate, hair-aware, and immune to the keypoint heuristics'
  // failure modes (hats, buns, unusual fringes).
  const foreheadY =
    hints.headTopY != null && Number.isFinite(hints.headTopY) ? hints.headTopY : span.foreheadY
  const headHeight = Math.max(1, foreheadY - chinY < 0 ? chinY - foreheadY : foreheadY - chinY)
  // NB: forehead is *above* chin in image-pixel space, so foreheadY < chinY.
  // The Math.max above keeps us robust to unusual key-point orderings.

  // Position the head-to-frame ratio inside the spec's allowed band
  // according to the user's slider preference. Default bias 0.5 sits
  // at the midpoint; bias 1 picks the upper bound (largest head);
  // bias 0 picks the lower bound (smallest head). Eye line stays at
  // the mid-point because that's the visually balanced position.
  const headBias = hints.headSizeBias ?? 0.5
  const targetHeadRatio =
    LERP_IN_BAND(spec.composition?.headHeightRatio, headBias) ?? DEFAULT_HEAD_RATIO
  const eyeFromTopRatio = MIDPOINT(spec.composition?.eyeLineFromTop) ?? DEFAULT_EYE_FROM_TOP

  let frameH = headHeight / targetHeadRatio
  let frameW = frameH * aspect

  // Reserve a small vertical padding above the head. Without this, the
  // hair-aware `foreheadY` can still kiss the frame top when the spec's
  // eyeFromTopRatio is small relative to the eye-to-hair distance.
  // Solve `eyeY − frameH × eyeFromTopRatio ≤ foreheadY − topPaddingPx`
  // for the smallest `frameH` that leaves room; if it's larger than the
  // natural frameH, grow.
  const safeEyeFromTopRatio = Math.max(eyeFromTopRatio, 0.01)
  const topPaddingPx = frameH * TOP_PADDING_RATIO
  const frameHMin = (eyeY - foreheadY + topPaddingPx) / safeEyeFromTopRatio
  if (frameHMin > frameH) {
    frameH = frameHMin
    frameW = frameH * aspect
  }

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

  // Shrink the frame so the head can land at its intended position
  // instead of being slammed against an image edge by a hard clamp.
  // The four constraints below are the maximum frame height/width
  // that still keeps the eye line / horizontal centre inside the
  // image. We pick the most restrictive and apply it once; if a
  // second axis still overflows we iterate one more time. Two passes
  // are enough — the second pass either re-balances perfectly or the
  // bounded clamp at the end mops up sub-pixel slop.
  const eyeFromBottomRatio = 1 - eyeFromTopRatio
  for (let pass = 0; pass < 2; pass++) {
    let scale = 1
    const topRoom = eyeY / Math.max(eyeFromTopRatio, 0.01)
    if (topRoom < frameH) scale = Math.min(scale, topRoom / frameH)
    const bottomRoom = (image.height - eyeY) / Math.max(eyeFromBottomRatio, 0.01)
    if (bottomRoom < frameH) scale = Math.min(scale, bottomRoom / frameH)
    const leftRoom = headCenterX * 2
    if (leftRoom < frameW) scale = Math.min(scale, leftRoom / frameW)
    const rightRoom = (image.width - headCenterX) * 2
    if (rightRoom < frameW) scale = Math.min(scale, rightRoom / frameW)
    if (scale >= 1) break
    frameW *= scale
    frameH *= scale
  }

  let top = eyeY - frameH * eyeFromTopRatio
  let left = headCenterX - frameW / 2

  // Defensive clamp — covers sub-pixel rounding when shrinking landed
  // right at an edge. Should never shift the head visibly off-target.
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

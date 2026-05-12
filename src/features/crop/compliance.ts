/**
 * Compliance check — given a chosen crop frame and the face we
 * detected, decide whether the resulting photo respects the spec's
 * composition rules.
 *
 * Returned codes (stable, used as i18n keys under `Crop.warnings.*`):
 *
 *   head-too-small      head height ratio < spec's lower bound (×0.95 grace)
 *   head-too-large      head height ratio > spec's upper bound (×1.05 grace)
 *   eye-too-high        eye Y / frame H < spec's lower bound
 *   eye-too-low         eye Y / frame H > spec's upper bound
 *   face-not-found      kept on the type union so the banner switch
 *                       stays exhaustive; we deliberately never emit
 *                       it — the friendly "Auto-centred" Info banner
 *                       replaces the persistent yellow warning when
 *                       no face is detected.
 *
 * `severity: 'error'` should block export; `'warn'` is shown as a soft
 * banner.
 *
 * NOTE: We share `estimateHeadVerticalSpan` with `auto-center.ts`, so
 * the hair-aware head-top estimate (bbox-derived hair allowance) flows
 * into the head-too-small / head-too-large bands here too. That is
 * intentional: the official photo specs measure head height from chin
 * to crown-of-hair, so this estimate matches the spec definition more
 * faithfully than the keypoint-only forehead approximation did.
 */

import { estimateHeadVerticalSpan } from './auto-center'
import type { CropFrame, FaceDetection, PhotoSpec } from '@/types/spec'

export type ComplianceCode =
  | 'head-too-small'
  | 'head-too-large'
  | 'eye-too-high'
  | 'eye-too-low'
  | 'face-not-found'

export interface ComplianceWarning {
  code: ComplianceCode
  severity: 'warn' | 'error'
}

export interface ComplianceResult {
  warnings: ComplianceWarning[]
  /** Head height divided by frame height, or null when no face. */
  headRatio: null | number
  /** Eye line distance from frame top, normalised, or null when no face. */
  eyeFromTop: null | number
}

export interface ComplianceHints {
  /**
   * Mask-derived head top (image-pixel y, hair-inclusive). Mirrors
   * the `AutoCenterHints.headTopY` field so compliance and autoCenter
   * agree on what "head height" means.
   */
  headTopY?: number
}

const HEAD_GRACE = 0.05 // ±5% — beyond this, surface a warning
const EYE_GRACE = 0.05

export function checkCompliance(
  frame: CropFrame,
  face: FaceDetection | null,
  spec: PhotoSpec,
  hints: ComplianceHints = {},
): ComplianceResult {
  if (!face) {
    // Don't emit `face-not-found`: it nags the user with a yellow
    // warning every time detection failed (CDN unreachable, photo
    // without a person, ...). The friendly "Auto-centred" Info banner
    // already covers this case.
    return {
      warnings: [],
      headRatio: null,
      eyeFromTop: null,
    }
  }

  const span = estimateHeadVerticalSpan(face)
  const { eyeY, chinY } = span
  const foreheadY =
    hints.headTopY != null && Number.isFinite(hints.headTopY) ? hints.headTopY : span.foreheadY
  // Spec head height ratio uses forehead-to-chin span. Guard against
  // weird key-point ordering.
  const headHeight = Math.abs(chinY - foreheadY)
  const headRatio = frame.h > 0 ? headHeight / frame.h : 0
  const eyeFromTop = frame.h > 0 ? (eyeY - frame.y) / frame.h : 0

  const warnings: ComplianceWarning[] = []

  const headBand = spec.composition?.headHeightRatio
  if (headBand) {
    const [lo, hi] = headBand
    if (headRatio < lo * (1 - HEAD_GRACE)) {
      warnings.push({ code: 'head-too-small', severity: 'warn' })
    } else if (headRatio > hi * (1 + HEAD_GRACE)) {
      warnings.push({ code: 'head-too-large', severity: 'warn' })
    }
  }

  const eyeBand = spec.composition?.eyeLineFromTop
  if (eyeBand) {
    const [lo, hi] = eyeBand
    if (eyeFromTop < lo - EYE_GRACE) {
      warnings.push({ code: 'eye-too-high', severity: 'warn' })
    } else if (eyeFromTop > hi + EYE_GRACE) {
      warnings.push({ code: 'eye-too-low', severity: 'warn' })
    }
  }

  return { warnings, headRatio, eyeFromTop }
}

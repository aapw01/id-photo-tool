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
 *   face-not-found      face was null (no detection); shown as info, not error
 *
 * `severity: 'error'` should block export; `'warn'` is shown as a soft
 * banner.
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
  headRatio: number | null
  /** Eye line distance from frame top, normalised, or null when no face. */
  eyeFromTop: number | null
}

const HEAD_GRACE = 0.05 // ±5% — beyond this, surface a warning
const EYE_GRACE = 0.05

export function checkCompliance(
  frame: CropFrame,
  face: FaceDetection | null,
  spec: PhotoSpec,
): ComplianceResult {
  if (!face) {
    return {
      warnings: [{ code: 'face-not-found', severity: 'warn' }],
      headRatio: null,
      eyeFromTop: null,
    }
  }

  const { eyeY, chinY, foreheadY } = estimateHeadVerticalSpan(face)
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

'use client'

/**
 * Studio crop-tab state.
 *
 * Holds the chosen PhotoSpec, the current crop frame in image-pixel
 * coordinates, the most recent face detection, and compliance
 * warnings. Each consumer subscribes to a single field via
 * `useCropStore((s) => s.field)` to avoid superfluous re-renders.
 *
 * `face` is *not* persisted across spec changes — the same face
 * detection drives multiple specs, so we cache it once per image.
 */

import { create } from 'zustand'

import type { CropFrame, FaceDetection, PhotoSpec } from '@/types/spec'

import type { ComplianceWarning } from './compliance'

export interface CropState {
  spec: PhotoSpec | null
  frame: CropFrame | null
  face: FaceDetection | null
  /** True while MediaPipe is fetching / running. */
  detecting: boolean
  faceError: string | null
  warnings: ComplianceWarning[]
  /** Whether the guideline overlay is shown above the frame. */
  showGuidelines: boolean
  /**
   * Position within the active spec's `headHeightRatio` band:
   *   0   → lower bound (head occupies the minimum legal share)
   *   0.5 → midpoint
   *   1   → upper bound (head fills the maximum legal share)
   *
   * Defaults to `1` so first-time users see a tight, head-dominant
   * crop — matching common user expectations for ID photos. The
   * slider in the UI lets them slide back towards a smaller head if
   * they want more headroom.
   */
  headSizeBias: number

  setSpec: (spec: PhotoSpec | null) => void
  setFrame: (frame: CropFrame | null) => void
  setFace: (face: FaceDetection | null) => void
  setDetecting: (detecting: boolean) => void
  setFaceError: (err: string | null) => void
  setWarnings: (w: ComplianceWarning[]) => void
  setShowGuidelines: (v: boolean) => void
  setHeadSizeBias: (v: number) => void
  reset: () => void
}

const DEFAULT_HEAD_SIZE_BIAS = 1

export const useCropStore = create<CropState>((set) => ({
  spec: null,
  frame: null,
  face: null,
  detecting: false,
  faceError: null,
  warnings: [],
  showGuidelines: true,
  headSizeBias: DEFAULT_HEAD_SIZE_BIAS,

  setSpec(spec) {
    set({ spec })
  },
  setFrame(frame) {
    set({ frame })
  },
  setFace(face) {
    set({ face })
  },
  setDetecting(detecting) {
    set({ detecting })
  },
  setFaceError(faceError) {
    set({ faceError })
  },
  setWarnings(warnings) {
    set({ warnings })
  },
  setShowGuidelines(showGuidelines) {
    set({ showGuidelines })
  },
  setHeadSizeBias(headSizeBias) {
    const clamped = headSizeBias < 0 ? 0 : headSizeBias > 1 ? 1 : headSizeBias
    set({ headSizeBias: clamped })
  },
  reset() {
    set({
      spec: null,
      frame: null,
      face: null,
      detecting: false,
      faceError: null,
      warnings: [],
      headSizeBias: DEFAULT_HEAD_SIZE_BIAS,
    })
  },
}))

export function __resetCropStoreForTesting(): void {
  useCropStore.setState({
    spec: null,
    frame: null,
    face: null,
    detecting: false,
    faceError: null,
    warnings: [],
    showGuidelines: true,
    headSizeBias: DEFAULT_HEAD_SIZE_BIAS,
  })
}

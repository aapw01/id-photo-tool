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

/**
 * Provenance of the current crop frame.
 *
 *   - `'auto'` — produced by `useCropFlow`'s `autoCenter` pass. Free
 *     to be replaced whenever a better signal (face, mask head-top,
 *     spec / bias change) arrives.
 *   - `'user'` — the user dragged / nudged the frame manually. The
 *     auto-pass leaves it alone unless an explicit override fires
 *     (currently: spec change or bias slider).
 */
export type FrameSource = 'auto' | 'user'

export interface CropState {
  spec: PhotoSpec | null
  frame: CropFrame | null
  /** Who last wrote `frame`. See `FrameSource`. */
  frameSource: FrameSource
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
  /**
   * Update `frame`. The second argument is the provenance; defaults
   * to `'user'` because most call sites are pointer / keyboard
   * handlers — the auto-pass in `useCropFlow` passes `'auto'`
   * explicitly.
   */
  setFrame: (frame: CropFrame | null, source?: FrameSource) => void
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
  frameSource: 'auto',
  face: null,
  detecting: false,
  faceError: null,
  warnings: [],
  showGuidelines: true,
  headSizeBias: DEFAULT_HEAD_SIZE_BIAS,

  setSpec(spec) {
    // A new spec invalidates any user-locked frame: the auto-center
    // pass needs to redraw against the new aspect ratio. Flipping
    // `frameSource` back to `'auto'` is what un-gates the effect.
    set({ spec, frameSource: 'auto' })
  },
  setFrame(frame, source = 'user') {
    set({ frame, frameSource: source })
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
      frameSource: 'auto',
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
    frameSource: 'auto',
    face: null,
    detecting: false,
    faceError: null,
    warnings: [],
    showGuidelines: true,
    headSizeBias: DEFAULT_HEAD_SIZE_BIAS,
  })
}

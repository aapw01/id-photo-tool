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

  setSpec: (spec: PhotoSpec | null) => void
  setFrame: (frame: CropFrame | null) => void
  setFace: (face: FaceDetection | null) => void
  setDetecting: (detecting: boolean) => void
  setFaceError: (err: string | null) => void
  setWarnings: (w: ComplianceWarning[]) => void
  setShowGuidelines: (v: boolean) => void
  reset: () => void
}

export const useCropStore = create<CropState>((set) => ({
  spec: null,
  frame: null,
  face: null,
  detecting: false,
  faceError: null,
  warnings: [],
  showGuidelines: true,

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
  reset() {
    set({
      spec: null,
      frame: null,
      face: null,
      detecting: false,
      faceError: null,
      warnings: [],
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
  })
}

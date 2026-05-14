'use client'

/**
 * Scanner store — small Zustand slice for the document-being-scanned.
 *
 * Strictly decoupled from `features/studio/store.ts`. Lives client-only.
 * Holds the original front / back File handles, the chosen DocSpec, and
 * the output mode (scan / copy / enhance). Nothing is persisted to
 * storage — privacy parity with the main Studio.
 *
 * For S1 (skeleton) the store is intentionally minimal; later
 * milestones will extend it with:
 *   - rectified bitmaps (after OpenCV.js perspective warp, S3)
 *   - watermark config (S5)
 *   - layout / paper settings (S5)
 *   - export-in-progress flag (S5–S6)
 */

import { create } from 'zustand'

export type OutputMode = 'scan' | 'copy' | 'enhance'

export interface ScannerState {
  /** Raw user upload — front side of the document. */
  frontFile: File | null
  /** Raw user upload — back side. Only relevant when `hasBack === true`. */
  backFile: File | null
  /** Whether this document type has a back side. Defaults to true (id-card / driver-license). */
  hasBack: boolean
  /** Selected `DocSpec.id`. Defaults to `cn-id-card`; full catalog ships in S6. */
  docSpecId: string
  /** Output rendering mode. */
  outputMode: OutputMode

  setFront: (file: File | null) => void
  setBack: (file: File | null) => void
  setHasBack: (hasBack: boolean) => void
  setDocSpecId: (id: string) => void
  setOutputMode: (mode: OutputMode) => void
  reset: () => void
}

const INITIAL = {
  frontFile: null,
  backFile: null,
  hasBack: true,
  docSpecId: 'cn-id-card',
  outputMode: 'scan' as OutputMode,
}

export const useScannerStore = create<ScannerState>((set) => ({
  ...INITIAL,
  setFront: (frontFile) => set({ frontFile }),
  setBack: (backFile) => set({ backFile }),
  setHasBack: (hasBack) => set({ hasBack }),
  setDocSpecId: (docSpecId) => set({ docSpecId }),
  setOutputMode: (outputMode) => set({ outputMode }),
  reset: () => set(INITIAL),
}))

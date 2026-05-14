'use client'

/**
 * Scanner store — Zustand slice that owns the document-being-scanned.
 *
 * Strictly decoupled from `features/studio/store.ts`. Lives client
 * only. Holds the decoded front / back `ImageBitmap`s (so the preview
 * pipeline can draw them without redecoding) plus user settings.
 * Nothing is persisted — privacy parity with the main Studio.
 *
 * Bitmap ownership: each slot stores a fully decoded `ImageBitmap`.
 * The store closes the previous bitmap on replace / clear so the GPU
 * texture pool isn't leaked.
 *
 * Future milestones will extend the state here:
 *   - rectified bitmaps (after OpenCV.js perspective warp, S3)
 *   - watermark config (S5)
 *   - layout / paper settings (S5)
 *   - export-in-progress flag (S5–S6)
 */

import { create } from 'zustand'

import { loadDocumentImage } from './lib/load-document-image'

export type OutputMode = 'scan' | 'copy' | 'enhance'

export interface ScannerSlot {
  /** Original user upload — kept so the UI can show name + size. */
  file: File
  /** Decoded bitmap with EXIF orientation applied. */
  bitmap: ImageBitmap
  /** Bytes used for decoding (HEIC slots hold the JPEG output). */
  blob: Blob
  /** True iff `blob` is the heic2any output, not the original file. */
  convertedFromHeic: boolean
}

export interface ScannerState {
  front: ScannerSlot | null
  back: ScannerSlot | null
  hasBack: boolean
  docSpecId: string
  outputMode: OutputMode

  setFrontImage: (file: File) => Promise<void>
  setBackImage: (file: File) => Promise<void>
  clearFront: () => void
  clearBack: () => void
  setHasBack: (hasBack: boolean) => void
  setDocSpecId: (id: string) => void
  setOutputMode: (mode: OutputMode) => void
  reset: () => void
}

const INITIAL: Pick<ScannerState, 'front' | 'back' | 'hasBack' | 'docSpecId' | 'outputMode'> = {
  front: null,
  back: null,
  hasBack: true,
  docSpecId: 'cn-id-card',
  outputMode: 'scan' as OutputMode,
}

function closeSlot(slot: ScannerSlot | null): void {
  slot?.bitmap.close?.()
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  ...INITIAL,

  async setFrontImage(file) {
    const loaded = await loadDocumentImage(file)
    closeSlot(get().front)
    set({
      front: {
        file: loaded.file,
        bitmap: loaded.bitmap,
        blob: loaded.blob,
        convertedFromHeic: loaded.convertedFromHeic,
      },
    })
  },

  async setBackImage(file) {
    const loaded = await loadDocumentImage(file)
    closeSlot(get().back)
    set({
      back: {
        file: loaded.file,
        bitmap: loaded.bitmap,
        blob: loaded.blob,
        convertedFromHeic: loaded.convertedFromHeic,
      },
    })
  },

  clearFront() {
    closeSlot(get().front)
    set({ front: null })
  },

  clearBack() {
    closeSlot(get().back)
    set({ back: null })
  },

  setHasBack(hasBack) {
    // Dropping `hasBack` also clears the back slot so the bitmap isn't
    // retained in memory while the user can't see it.
    if (!hasBack) {
      closeSlot(get().back)
      set({ hasBack: false, back: null })
      return
    }
    set({ hasBack: true })
  },

  setDocSpecId(docSpecId) {
    set({ docSpecId })
  },

  setOutputMode(outputMode) {
    set({ outputMode })
  },

  reset() {
    const prev = get()
    closeSlot(prev.front)
    closeSlot(prev.back)
    set(INITIAL)
  },
}))

'use client'

/**
 * Scanner store — Zustand slice that owns the document-being-scanned
 * end-to-end:
 *
 *   - Raw upload state per side (front / back): file, decoded
 *     bitmap, blob, HEIC flag — managed by S2.
 *   - Rectification state per side: target spec, detected quad,
 *     output blob, status (idle / processing / ready / error) —
 *     added by S3.
 *
 * Strictly decoupled from `features/studio/store.ts`. Lives client
 * only. Nothing is persisted — privacy parity with the main Studio.
 *
 * Bitmap ownership: each slot stores a fully decoded `ImageBitmap`.
 * The store closes the previous bitmap on replace / clear so the GPU
 * texture pool isn't leaked.
 *
 * Concurrency model: a rectify call captures the `bitmap` reference
 * it started from, then re-checks store identity before writing the
 * result. If the user replaced the upload mid-process, the stale
 * result is dropped on the floor (no torn state).
 */

import { create } from 'zustand'

import { loadDocumentImage } from './lib/load-document-image'
import { rectifyDocument } from './lib/rectify'
import { DEFAULT_DOC_SPEC_ID, getDocSpec } from './lib/doc-specs'
import { renderOutputMode, type OutputMode } from './lib/render-modes'
import type { Quad } from './lib/detect-corners'

export type { OutputMode }

export type RectifyState = 'idle' | 'processing' | 'ready' | 'error'
export type RenderState = 'idle' | 'processing' | 'ready'

export interface RectifiedResult {
  blob: Blob
  quad: Quad
  width: number
  height: number
  /** True iff `quad` came from auto-detection (not fallback or user edit). */
  detected: boolean
}

export interface RenderedOutput {
  blob: Blob
  mode: OutputMode
}

export interface ScannerSlot {
  /** Original user upload — kept so the UI can show name + size. */
  file: File
  /** Decoded bitmap with EXIF orientation applied. */
  bitmap: ImageBitmap
  /** Bytes used for decoding (HEIC slots hold the JPEG output). */
  blob: Blob
  /** True iff `blob` is the heic2any output, not the original file. */
  convertedFromHeic: boolean
  /** Raw color rectified output (post warpPerspective, pre output mode). */
  rectified: RectifiedResult | null
  /** State machine for rectification. */
  rectifyState: RectifyState
  /** Last error message, present iff rectifyState === 'error'. */
  rectifyError: string | null
  /** Output-mode applied final blob — what the UI displays + downloads. */
  rendered: RenderedOutput | null
  /** State machine for the post-rectify mode pass. */
  renderState: RenderState
}

export type ScannerSide = 'front' | 'back'

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
  /**
   * Re-run the rectify pipeline for `side`. If `quad` is provided
   * it overrides the auto-detection (used by the corner editor).
   */
  rectifySide: (side: ScannerSide, quad?: Quad) => Promise<void>
  /**
   * Re-apply the current `outputMode` to an already-rectified side.
   * Triggered internally after rectify completion and when the user
   * flips the mode toggle.
   */
  renderSide: (side: ScannerSide) => Promise<void>
  reset: () => void
}

const INITIAL: Pick<ScannerState, 'front' | 'back' | 'hasBack' | 'docSpecId' | 'outputMode'> = {
  front: null,
  back: null,
  hasBack: true,
  docSpecId: DEFAULT_DOC_SPEC_ID,
  outputMode: 'scan' as OutputMode,
}

function closeSlot(slot: ScannerSlot | null): void {
  slot?.bitmap.close?.()
}

function makeFreshSlot(loaded: Awaited<ReturnType<typeof loadDocumentImage>>): ScannerSlot {
  return {
    file: loaded.file,
    bitmap: loaded.bitmap,
    blob: loaded.blob,
    convertedFromHeic: loaded.convertedFromHeic,
    rectified: null,
    rectifyState: 'idle',
    rectifyError: null,
    rendered: null,
    renderState: 'idle',
  }
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  ...INITIAL,

  async setFrontImage(file) {
    const loaded = await loadDocumentImage(file)
    closeSlot(get().front)
    set({ front: makeFreshSlot(loaded) })
    void get().rectifySide('front')
  },

  async setBackImage(file) {
    const loaded = await loadDocumentImage(file)
    closeSlot(get().back)
    set({ back: makeFreshSlot(loaded) })
    void get().rectifySide('back')
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
    if (!hasBack) {
      closeSlot(get().back)
      set({ hasBack: false, back: null })
      return
    }
    set({ hasBack: true })
  },

  setDocSpecId(docSpecId) {
    if (docSpecId === get().docSpecId) return
    set({ docSpecId })
    // Output pixel dimensions changed — both sides need re-rectifying.
    // We fire and forget; UI shows the per-side processing state.
    if (get().front) void get().rectifySide('front')
    if (get().back && get().hasBack) void get().rectifySide('back')
  },

  setOutputMode(outputMode) {
    if (outputMode === get().outputMode) return
    set({ outputMode })
    // Re-render any already-rectified sides with the new mode. We
    // don't re-rectify (that's pure pixel work, no OpenCV) — just
    // re-color via render-modes.
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  async rectifySide(side, overrideQuad) {
    const baseline = get()[side]
    if (!baseline) return
    const spec = getDocSpec(get().docSpecId)
    const sourceBitmap = baseline.bitmap

    // Mark as processing; preserve the slot's other fields.
    set((state) => {
      const current = state[side]
      if (!current || current.bitmap !== sourceBitmap) return state
      return {
        [side]: {
          ...current,
          rectifyState: 'processing',
          rectifyError: null,
        },
      } as Partial<ScannerState>
    })

    try {
      const result = await rectifyDocument({
        bitmap: sourceBitmap,
        spec,
        quad: overrideQuad,
      })
      set((state) => {
        const current = state[side]
        // Guard: user replaced the upload while we were warping.
        if (!current || current.bitmap !== sourceBitmap) return state
        return {
          [side]: {
            ...current,
            rectifyState: 'ready',
            rectifyError: null,
            rectified: {
              blob: result.blob,
              quad: result.quad,
              width: result.width,
              height: result.height,
              detected: result.detected,
            },
            // The previous mode-applied output is stale once the
            // underlying rectified bytes change — clear it so the
            // preview doesn't briefly show the old mode'd PNG.
            rendered: null,
            renderState: 'idle',
          },
        } as Partial<ScannerState>
      })
      // Kick off the mode pass with the current setting.
      void get().renderSide(side)
    } catch (err) {
      set((state) => {
        const current = state[side]
        if (!current || current.bitmap !== sourceBitmap) return state
        return {
          [side]: {
            ...current,
            rectifyState: 'error',
            rectifyError: err instanceof Error ? err.message : String(err),
          },
        } as Partial<ScannerState>
      })
    }
  },

  async renderSide(side) {
    const baseline = get()[side]
    if (!baseline?.rectified) return
    const sourceBlob = baseline.rectified.blob
    const mode = get().outputMode
    set((state) => {
      const current = state[side]
      if (!current?.rectified || current.rectified.blob !== sourceBlob) return state
      return {
        [side]: { ...current, renderState: 'processing' },
      } as Partial<ScannerState>
    })
    try {
      const out = await renderOutputMode(sourceBlob, mode)
      set((state) => {
        const current = state[side]
        // Guard: rectified blob changed (user redetected mid-render).
        if (!current?.rectified || current.rectified.blob !== sourceBlob) return state
        return {
          [side]: {
            ...current,
            renderState: 'ready',
            rendered: { blob: out.blob, mode: out.mode },
          },
        } as Partial<ScannerState>
      })
    } catch {
      // Best-effort: leave rectified untouched; UI falls back to it.
      set((state) => {
        const current = state[side]
        if (!current?.rectified || current.rectified.blob !== sourceBlob) return state
        return {
          [side]: { ...current, renderState: 'idle' },
        } as Partial<ScannerState>
      })
    }
  },

  reset() {
    const prev = get()
    closeSlot(prev.front)
    closeSlot(prev.back)
    set(INITIAL)
  },
}))

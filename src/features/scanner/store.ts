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

import { loadDocumentImage, type LoadedDocumentImage } from './lib/load-document-image'
import { rectifyDocument } from './lib/rectify'
import { DEFAULT_DOC_SPEC_ID, getDocSpec } from './lib/doc-specs'
import { renderOutputMode, type OutputMode } from './lib/render-modes'
import { rotateImage } from './lib/rotate-image'
import {
  clampWatermarkOpacity,
  DEFAULT_WATERMARK_OPACITY,
  type WatermarkConfig,
  type WatermarkDensity,
} from './lib/watermark'
import { packSheet, type PackedSide, type PaperSize } from './lib/pack-a4'
import { exportPackedSheetToPdf } from './lib/export-pdf'
import { rotateQuadCW90, type Quad } from './lib/detect-corners'

export type { PaperSize }

export type { OutputMode, WatermarkConfig, WatermarkDensity }

export type RectifyState = 'idle' | 'processing' | 'ready' | 'error'
export type RenderState = 'idle' | 'processing' | 'ready'

export interface RectifiedResult {
  blob: Blob
  quad: Quad
  width: number
  height: number
  /**
   * True iff `quad` came from the user's manual corner editor. False
   * means the warp used `defaultQuad`, which is a centered crop at
   * the spec's aspect ratio — useful for the preview pane to gently
   * nudge the user to adjust corners for a correct result.
   */
  userAdjusted: boolean
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
  /** Bytes used for decoding (HEIC slots hold the JPEG output; PDFs hold the rendered PNG). */
  blob: Blob
  /** True iff `blob` is the heic2any output, not the original file. */
  convertedFromHeic: boolean
  /** True iff `blob` is the rendered PNG of a PDF page, not the original file. */
  convertedFromPdf: boolean
  /**
   * Total pages in the source PDF (1 for single-page docs).
   * `undefined` for non-PDF uploads. The UI uses this to surface a
   * "page 1 of N" badge / toast on multi-page PDFs.
   */
  sourcePageCount: number | undefined
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

/**
 * Maximum corner radius the UI allows in pixels (relative to the
 * 300-DPI rectified-side canvas). 80 px ≈ 6.8 mm — slightly past the
 * physical corner radius of a passport / bank card so the user gets
 * room to dial in pronounced rounded edges without nuking the card
 * geometry. The kernel clamps further to `min(width, height) / 2` per
 * card, so this is a UX cap, not a correctness one.
 */
export const MAX_CORNER_RADIUS_PX = 80

/**
 * Cached "what your sheet will look like" preview blob. Produced by
 * `packCurrentSides` — the SAME function the export buttons drive —
 * so the dialog renders byte-for-byte what `Download PNG` would
 * write to disk (the PDF path just wraps this PNG in a vector page).
 *
 * `signature` fingerprints every setting that influences the packed
 * sheet (paper size, watermark, corner radius, output mode, doc spec
 * id, plus the front/back rectified blob identities). The store
 * compares it to the *current* state on every `regeneratePreview`
 * call so we can:
 *   1. short-circuit a re-pack when nothing changed (the user
 *      reopened the dialog without touching anything), and
 *   2. drop a stale result if inputs changed mid-pack.
 *
 * `objectUrl` is created via `URL.createObjectURL(blob)`. The store
 * owns its lifecycle — every replacement revokes the previous URL
 * so we never leak.
 */
export interface ScannerPreview {
  blob: Blob
  objectUrl: string
  signature: string
  paperSize: PaperSize
}

export type PreviewState = 'idle' | 'packing' | 'ready' | 'error'

export interface ScannerState {
  front: ScannerSlot | null
  back: ScannerSlot | null
  hasBack: boolean
  docSpecId: string
  outputMode: OutputMode
  watermark: WatermarkConfig
  /** Paper size used for the packed A4/Letter/A5 export sheet. */
  paperSize: PaperSize
  /**
   * Optional rounded-corner radius applied to each rectified side, in
   * pixels at the side's 300-DPI render resolution. 0 = square corners
   * (default), max = `MAX_CORNER_RADIUS_PX`. Same value is reused for
   * preview, single-side PNG download, and the A4 pack path so the
   * corners on every surface match.
   */
  cornerRadiusPx: number

  /**
   * Cached packed-sheet preview. `null` until the user first opens
   * the preview dialog (or any time the sheet can't be produced —
   * e.g. no sides ready).
   */
  preview: ScannerPreview | null
  /** State machine for the preview pack pipeline. */
  previewState: PreviewState
  /** Last preview error, present iff previewState === 'error'. */
  previewError: string | null

  /**
   * Decode the file, install it as the front slot, and kick off
   * rectification. Returns the loaded metadata so the caller (the
   * upload card) can surface a "page 1 of N" toast when the upload
   * was a multi-page PDF — the store stays free of i18n + toast
   * concerns.
   */
  setFrontImage: (file: File) => Promise<LoadedDocumentImage>
  /** Same contract as `setFrontImage` but targets the back slot. */
  setBackImage: (file: File) => Promise<LoadedDocumentImage>
  clearFront: () => void
  clearBack: () => void
  setHasBack: (hasBack: boolean) => void
  setDocSpecId: (id: string) => void
  setOutputMode: (mode: OutputMode) => void
  /**
   * Toggle the optional anti-misuse watermark. Off by default so
   * previews and exports stay clean until the user opts in.
   */
  setWatermarkEnabled: (enabled: boolean) => void
  /** Update watermark text. Empty string ⇒ caller-localized fallback is used. */
  setWatermarkText: (text: string) => void
  /** Update watermark opacity. Clamped to [0.3, 0.7] in the kernel. */
  setWatermarkOpacity: (opacity: number) => void
  /** Update watermark density (sparse / normal / dense). */
  setWatermarkDensity: (density: WatermarkDensity) => void
  /** Update paper size for sheet export (A4 / Letter / A5). */
  setPaperSize: (paperSize: PaperSize) => void
  /**
   * Update the rounded-corner radius (px) applied to every rectified
   * side. Clamped to `[0, MAX_CORNER_RADIUS_PX]` here so a tampered
   * value never reaches the kernel; per-side absolute cap (half the
   * shorter side) is enforced inside `renderOutputMode`.
   */
  setCornerRadiusPx: (px: number) => void
  /**
   * Re-run the rectify pipeline for `side`. If `quad` is provided
   * it overrides the auto-detection (used by the corner editor).
   */
  rectifySide: (side: ScannerSide, quad?: Quad) => Promise<void>
  /**
   * Rotate the source bitmap for `side` 90° clockwise, replacing
   * both the slot's bitmap and its preview blob. Any rectified /
   * rendered output is invalidated and a fresh rectify kicks off
   * immediately so the user sees the rotated preview.
   */
  rotateSide: (side: ScannerSide) => Promise<void>
  /**
   * Re-apply the current `outputMode` to an already-rectified side.
   * Triggered internally after rectify completion and when the user
   * flips the mode toggle.
   */
  renderSide: (side: ScannerSide) => Promise<void>

  /**
   * Pack the currently-rendered sides onto A4 and return a PDF blob.
   * Returns `null` when nothing is ready to export. Caller is
   * responsible for triggering the download (object URL + <a>).
   */
  exportPdfBlob: () => Promise<Blob | null>
  /**
   * Pack the currently-rendered sides onto A4 and return the PNG.
   * Same null contract as `exportPdfBlob`.
   */
  exportA4PngBlob: () => Promise<Blob | null>

  /**
   * Regenerate the cached preview blob from the current store
   * snapshot. Resolves with the cached preview when nothing changed
   * since the last pack (signature hit), with `null` when there's
   * nothing to pack (no rectified sides), and with the freshly
   * packed `ScannerPreview` otherwise. Always revokes the previous
   * object URL when committing a replacement so we never leak.
   */
  regeneratePreview: () => Promise<ScannerPreview | null>
  /**
   * Drop the cached preview and revoke its object URL. Used by the
   * scanner shell on unmount so a left-over preview doesn't keep
   * a blob URL alive after the user navigates away.
   */
  clearPreview: () => void

  reset: () => void
}

const INITIAL: Pick<
  ScannerState,
  | 'front'
  | 'back'
  | 'hasBack'
  | 'docSpecId'
  | 'outputMode'
  | 'watermark'
  | 'paperSize'
  | 'cornerRadiusPx'
  | 'preview'
  | 'previewState'
  | 'previewError'
> = {
  front: null,
  back: null,
  hasBack: true,
  docSpecId: DEFAULT_DOC_SPEC_ID,
  outputMode: 'scan' as OutputMode,
  watermark: {
    enabled: false,
    text: '',
    opacity: DEFAULT_WATERMARK_OPACITY,
    density: 'normal',
  },
  paperSize: 'a4' as PaperSize,
  cornerRadiusPx: 0,
  preview: null,
  previewState: 'idle',
  previewError: null,
}

/**
 * Per-`Blob` identity tokens used to fingerprint preview inputs.
 *
 * Two distinct `renderOutputMode` runs always produce different
 * `Blob` references even when the bytes happen to be identical, so
 * reference identity is the cheapest "did the upstream blob change"
 * check. We assign each blob a sequential id the first time it's
 * seen and stash it in a `WeakMap` so the table is GC-friendly —
 * once the blob is unreachable the entry disappears with it.
 *
 * The id participates in the preview signature; if a rectify run
 * produces a new blob, the signature changes and the cached preview
 * is invalidated automatically.
 */
const blobIdentityTable = new WeakMap<Blob, number>()
let blobIdentityCounter = 0
function blobIdentity(blob: Blob | null | undefined): number {
  if (!blob) return 0
  let id = blobIdentityTable.get(blob)
  if (id === undefined) {
    id = ++blobIdentityCounter
    blobIdentityTable.set(blob, id)
  }
  return id
}

/**
 * Build the signature string used to dedupe preview re-packs.
 *
 * Includes every input that `packCurrentSides` reads. The order is
 * fixed and the separator (`|`) cannot appear in the embedded values
 * (we only emit numbers, booleans, paper-size enums, and small
 * curated strings), so the resulting string is collision-free without
 * needing a real hash.
 *
 * Watermark text is intentionally length-bounded by the UI (48 char
 * max) so we just embed it verbatim.
 */
export function computePreviewSignature(state: ScannerState): string {
  const wm = state.watermark
  return [
    state.paperSize,
    state.outputMode,
    state.docSpecId,
    state.cornerRadiusPx,
    wm.enabled ? 1 : 0,
    wm.enabled ? wm.text : '',
    wm.enabled ? wm.opacity.toFixed(3) : '',
    wm.enabled ? wm.density : '',
    blobIdentity(state.front?.rectified?.blob),
    blobIdentity(state.back?.rectified?.blob),
  ].join('|')
}

function clampCornerRadius(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 0
  if (px > MAX_CORNER_RADIUS_PX) return MAX_CORNER_RADIUS_PX
  return Math.round(px)
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
    convertedFromPdf: loaded.convertedFromPdf,
    sourcePageCount: loaded.sourcePageCount,
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
    return loaded
  },

  async setBackImage(file) {
    const loaded = await loadDocumentImage(file)
    closeSlot(get().back)
    set({ back: makeFreshSlot(loaded) })
    void get().rectifySide('back')
    return loaded
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
    // Re-render any already-rectified sides with the new mode —
    // pure 2D Canvas recolor via render-modes, no warp.
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  setWatermarkEnabled(enabled) {
    if (enabled === get().watermark.enabled) return
    set((state) => ({ watermark: { ...state.watermark, enabled } }))
    // Toggling visibility changes the per-side blob and the page
    // overlay — re-render so the preview / single-side PNG follow.
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  setWatermarkText(text) {
    if (text === get().watermark.text) return
    set((state) => ({ watermark: { ...state.watermark, text } }))
    // Re-render the per-side blobs so the live preview + single-side
    // PNG download reflect the new watermark text. The A4 export path
    // re-renders watermark-free per side, so this does not produce a
    // double watermark on the packed sheet.
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  setWatermarkOpacity(opacity) {
    const next = clampWatermarkOpacity(opacity)
    if (next === get().watermark.opacity) return
    set((state) => ({ watermark: { ...state.watermark, opacity: next } }))
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  setWatermarkDensity(density) {
    if (density === get().watermark.density) return
    set((state) => ({ watermark: { ...state.watermark, density } }))
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  setPaperSize(paperSize) {
    if (paperSize === get().paperSize) return
    set({ paperSize })
    // Paper size only affects export; no need to re-render per-side.
  },

  setCornerRadiusPx(px) {
    const next = clampCornerRadius(px)
    if (next === get().cornerRadiusPx) return
    set({ cornerRadiusPx: next })
    // The radius bakes into the per-side blob (alpha-cut corners), so
    // both sides need a re-render to keep the preview / single-PNG
    // download in sync. Pack/export pulls the same value at trigger
    // time, so it just works.
    if (get().front?.rectified) void get().renderSide('front')
    if (get().back?.rectified && get().hasBack) void get().renderSide('back')
  },

  async rotateSide(side) {
    const slot = get()[side]
    if (!slot) return
    // Snapshot the previous bitmap dimensions + manually-adjusted
    // quad before we rotate. The quad lives in source-bitmap pixel
    // space, so rotating the bitmap also rotates the quad — without
    // this remap the next rectify would silently reset to the
    // default center crop.
    const prevHeight = slot.bitmap.height
    const prevQuad = slot.rectified && slot.rectified.userAdjusted ? slot.rectified.quad : null

    let rotated: Awaited<ReturnType<typeof rotateImage>>
    try {
      rotated = await rotateImage(slot.bitmap, 90)
    } catch {
      // Canvas / toBlob failures are silently swallowed — the
      // existing slot stays untouched so the user can retry.
      return
    }
    // Close the previous bitmap before we drop our last reference.
    slot.bitmap.close?.()
    set((state) => {
      const current = state[side]
      if (!current) return state
      return {
        [side]: {
          ...current,
          bitmap: rotated.bitmap,
          blob: rotated.blob,
          // Rotation invalidates the warped quad coordinate space —
          // wipe the rectified output and kick a fresh pass.
          rectified: null,
          rectifyState: 'idle',
          rectifyError: null,
          rendered: null,
          renderState: 'idle',
        },
      } as Partial<ScannerState>
    })
    const carriedQuad = prevQuad ? rotateQuadCW90(prevQuad, prevHeight) : undefined
    void get().rectifySide(side, carriedQuad)
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
              userAdjusted: overrideQuad !== undefined,
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
    const watermark = get().watermark
    const cornerRadiusPx = get().cornerRadiusPx
    set((state) => {
      const current = state[side]
      if (!current?.rectified || current.rectified.blob !== sourceBlob) return state
      return {
        [side]: { ...current, renderState: 'processing' },
      } as Partial<ScannerState>
    })
    try {
      // Watermark is opt-in: pass it through only when the user has
      // turned it on so the per-side preview / single PNG stays clean
      // by default. `drawWatermark` also guards on `enabled` for
      // defence in depth. Corner radius (0 by default) carves the
      // rectified card into a rounded rect via alpha clipping.
      const out = await renderOutputMode(sourceBlob, mode, {
        watermark: watermark.enabled ? watermark : undefined,
        cornerRadiusPx,
      })
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

  async exportPdfBlob() {
    const packed = await packCurrentSides(get())
    if (!packed) return null
    return exportPackedSheetToPdf({ packed, title: 'Pixfit Scanner' })
  },

  async exportA4PngBlob() {
    const packed = await packCurrentSides(get())
    return packed?.blob ?? null
  },

  async regeneratePreview() {
    const startSig = computePreviewSignature(get())
    const cached = get().preview
    // Cache hit: the user reopened the dialog with the same inputs.
    // We hand back the cached preview verbatim — same blob, same
    // object URL — so the dialog stays interactive instantly.
    if (cached && cached.signature === startSig && get().previewState === 'ready') {
      return cached
    }

    set({ previewState: 'packing', previewError: null })

    let packed: Awaited<ReturnType<typeof packCurrentSides>>
    try {
      packed = await packCurrentSides(get())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ previewState: 'error', previewError: message })
      return null
    }

    // Race guard. If the user changed an input mid-pack (paper size
    // slider, watermark toggle, …) the result we just produced is
    // already stale. Drop it on the floor — another `regeneratePreview`
    // call is either already in flight or about to be triggered by
    // the dialog's input-watcher effect.
    if (computePreviewSignature(get()) !== startSig) {
      set({ previewState: 'idle' })
      return null
    }

    if (!packed) {
      // Nothing to pack (no rectified sides). Drop any cached preview
      // so the dialog doesn't show a stale sheet for a now-empty
      // workspace.
      const prev = get().preview
      if (prev) URL.revokeObjectURL(prev.objectUrl)
      set({ preview: null, previewState: 'idle' })
      return null
    }

    // Commit: revoke the previous URL FIRST so we never have two URLs
    // pointing at orphaned blobs alive at once.
    const prev = get().preview
    if (prev) URL.revokeObjectURL(prev.objectUrl)

    const next: ScannerPreview = {
      blob: packed.blob,
      objectUrl: URL.createObjectURL(packed.blob),
      signature: startSig,
      paperSize: get().paperSize,
    }
    set({ preview: next, previewState: 'ready' })
    return next
  },

  clearPreview() {
    const prev = get().preview
    if (prev) URL.revokeObjectURL(prev.objectUrl)
    set({ preview: null, previewState: 'idle', previewError: null })
  },

  reset() {
    const prev = get()
    closeSlot(prev.front)
    closeSlot(prev.back)
    // Revoke the cached preview URL before we tear the state back —
    // `set(INITIAL)` would otherwise leak the URL.
    if (prev.preview) URL.revokeObjectURL(prev.preview.objectUrl)
    set(INITIAL)
  },
}))

/**
 * Collect the ready-to-export sides from the current store snapshot
 * and pack them onto the chosen paper size. Skips slots that are
 * still rectifying so the user never accidentally exports a partial
 * sheet.
 *
 * Important: `slot.rendered.blob` carries the per-side watermark used
 * by the preview / single-side PNG download. We must NOT feed that
 * blob into `packSheet` — it would compose the per-side watermark with
 * the page-wide one and reintroduce the double-watermark look. Instead
 * we re-run `renderOutputMode` on the clean rectified blob without a
 * watermark and let `packSheet` stamp the single page-wide layer. The
 * extra pass is cheap (a pure pixel sweep, ~50–100 ms per ID-card-
 * sized image).
 */
async function packCurrentSides(state: ScannerState) {
  const spec = getDocSpec(state.docSpecId)
  const mode = state.outputMode
  const cornerRadiusPx = state.cornerRadiusPx
  const sides: PackedSide[] = []

  // Watermark is intentionally omitted from the per-side re-render —
  // packSheet stamps the single page-wide layer. Corner radius IS
  // applied here so the cards in the A4 export carve out white from
  // packSheet's background (matching what the user sees in preview).
  if (state.front?.rectified) {
    const clean = await renderOutputMode(state.front.rectified.blob, mode, {
      cornerRadiusPx,
    })
    sides.push({ blob: clean.blob, spec })
  }
  // No explicit gate on `state.hasBack`: if the user uploaded a back
  // image, we pack it; if they didn't, the slot is null and we skip.
  // The `hasBack` field is kept on the store for API stability but no
  // longer affects pack/export selection.
  if (state.back?.rectified) {
    const clean = await renderOutputMode(state.back.rectified.blob, mode, {
      cornerRadiusPx,
    })
    sides.push({ blob: clean.blob, spec })
  }

  return packSheet(sides, state.paperSize, {
    watermark: state.watermark.enabled ? state.watermark : undefined,
  })
}

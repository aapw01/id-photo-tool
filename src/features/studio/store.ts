'use client'

/**
 * Studio store — a small Zustand slice for the photo-being-edited.
 *
 * Lives client-side only. Holds the original File, the decoded
 * ImageBitmap (cached after first decode), and the mask returned by
 * the segmentation worker. Everything is in-memory; we deliberately do
 * NOT persist the File so a refresh resets the studio (privacy + perf).
 */

import { create } from 'zustand'

import type { SegmentResult } from '@/features/segmentation/segmentation-client'

export interface StudioState {
  file: File | null
  bitmap: ImageBitmap | null
  /**
   * Downscaled copy of `bitmap` with its longest side capped at
   * `PREVIEW_LONGSIDE_PX`. Used by the live studio preview and the
   * crop overlay so dragging / tab switches don't redraw a 20MP image
   * on every render. Equal to `bitmap` (same reference) when the
   * source is already small enough. The export and layout pipelines
   * keep using the full-res `bitmap` so output quality is unchanged.
   */
  previewBitmap: ImageBitmap | null
  /** Last successful mask. */
  mask: ImageData | null
  /**
   * Decontaminated foreground RGBA produced by the segmentation worker
   * (alpha matte + spill suppression already applied). Long side capped
   * at the worker's foreground budget so this stays cheap to hold.
   * Export hooks use this directly when the target resolution fits
   * inside the cap; otherwise they rebuild on the main thread.
   */
  foreground: ImageData | null
  /** Inference metadata for UI ("WebGPU · 234 ms"). */
  lastInference: { backend: SegmentResult['backend']; durationMs: number } | null

  setFile: (file: File | null) => Promise<void>
  setMask: (mask: ImageData | null, meta?: SegmentResult) => void
  reset: () => void
}

/** Cap the preview bitmap at this longest-side dimension. */
const PREVIEW_LONGSIDE_PX = 1600

async function decodeFile(file: File): Promise<ImageBitmap> {
  // createImageBitmap is the fastest, GPU-friendly decode path. Falls
  // back to URL.createObjectURL → <img> when unavailable (very old
  // browsers); not implemented here — modern browsers all support
  // direct File decode.
  return createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
}

class PreviewAbortError extends Error {
  constructor() {
    super('preview downscale aborted')
    this.name = 'PreviewAbortError'
  }
}

/**
 * Produce a downscaled `ImageBitmap` from `source` with the longest
 * side capped at `PREVIEW_LONGSIDE_PX`. Returns the same reference
 * when the source is already small enough — callers can then re-use
 * the original bitmap without paying for an unnecessary draw.
 *
 * Cancellation: `signal.aborted` is checked after every async
 * boundary. When a faster-arriving setFile aborts mid-downscale,
 * we throw `PreviewAbortError` so the caller can close the partial
 * result rather than leaving a dangling ImageBitmap.
 */
async function makePreviewBitmap(source: ImageBitmap, signal: AbortSignal): Promise<ImageBitmap> {
  const longest = Math.max(source.width, source.height)
  if (longest <= PREVIEW_LONGSIDE_PX) return source

  const scale = PREVIEW_LONGSIDE_PX / longest
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))

  // Prefer OffscreenCanvas + transferToImageBitmap when available — it
  // sidesteps a roundtrip through the DOM. Fall back to a DOM canvas
  // wrapped in createImageBitmap for older Safari.
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const off = new OffscreenCanvas(w, h)
      const ctx = off.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source, 0, 0, w, h)
        if (typeof off.transferToImageBitmap === 'function') {
          if (signal.aborted) throw new PreviewAbortError()
          return off.transferToImageBitmap()
        }
        if (typeof createImageBitmap === 'function') {
          const fresh = await createImageBitmap(off)
          if (signal.aborted) {
            fresh.close?.()
            throw new PreviewAbortError()
          }
          return fresh
        }
      }
    } catch (err) {
      if (err instanceof PreviewAbortError) throw err
      // fall through to the DOM canvas path
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, w, h)
  }
  if (typeof createImageBitmap === 'function') {
    const fresh = await createImageBitmap(canvas)
    if (signal.aborted) {
      fresh.close?.()
      throw new PreviewAbortError()
    }
    return fresh
  }
  // Last-ditch fallback — return the original. Preview will be slower
  // but functional.
  return source
}

function closePreview(state: Pick<StudioState, 'bitmap' | 'previewBitmap'>): void {
  // Only close the preview when it's actually a distinct bitmap; when
  // the original was small we re-used the same reference.
  if (state.previewBitmap && state.previewBitmap !== state.bitmap) {
    state.previewBitmap.close?.()
  }
}

// One in-flight downscale at a time. Living at module scope keeps
// `setFile` callable in arbitrary order without each invocation
// having to coordinate via the store's own state.
let previewAbortController: AbortController | null = null

export const useStudioStore = create<StudioState>((set, get) => ({
  file: null,
  bitmap: null,
  previewBitmap: null,
  mask: null,
  foreground: null,
  lastInference: null,

  async setFile(file) {
    // Cancel any in-flight downscale before swapping the bitmap. The
    // previous controller is replaced even when `file === null` so a
    // pending downscale doesn't write into the cleared state.
    previewAbortController?.abort()
    const controller = new AbortController()
    previewAbortController = controller

    // Release any previous bitmap(s) before swapping in a new one.
    const prev = get()
    closePreview(prev)
    if (prev.bitmap) prev.bitmap.close()

    if (!file) {
      set({
        file: null,
        bitmap: null,
        previewBitmap: null,
        mask: null,
        foreground: null,
        lastInference: null,
      })
      return
    }

    let bitmap: ImageBitmap
    try {
      bitmap = await decodeFile(file)
    } catch (err) {
      set({
        file: null,
        bitmap: null,
        previewBitmap: null,
        mask: null,
        foreground: null,
        lastInference: null,
      })
      throw err
    }
    // Set the full-res bitmap immediately so anything that needs it
    // (export, layout) doesn't wait on the downscale step. The preview
    // bitmap follows on the next microtask.
    set({
      file,
      bitmap,
      previewBitmap: bitmap,
      mask: null,
      foreground: null,
      lastInference: null,
    })
    try {
      const preview = await makePreviewBitmap(bitmap, controller.signal)
      // Guard against the user replacing the photo before downscale
      // completes — only swap in the preview when the underlying
      // bitmap still matches.
      if (get().bitmap === bitmap) {
        set({ previewBitmap: preview })
      } else if (preview !== bitmap) {
        preview.close?.()
      }
    } catch {
      // Preview generation is best-effort. The original bitmap is
      // already wired up as the fallback above. Aborts also land here
      // and need no extra handling — the next setFile already owns the
      // up-to-date state.
    }
  },

  setMask(mask, meta) {
    set({
      mask,
      foreground: meta?.foreground ?? null,
      lastInference: meta ? { backend: meta.backend, durationMs: meta.durationMs } : null,
    })
  },

  reset() {
    previewAbortController?.abort()
    previewAbortController = null
    const prev = get()
    closePreview(prev)
    if (prev.bitmap) prev.bitmap.close()
    set({
      file: null,
      bitmap: null,
      previewBitmap: null,
      mask: null,
      foreground: null,
      lastInference: null,
    })
  },
}))

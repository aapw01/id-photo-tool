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
  /** Last successful mask. */
  mask: ImageData | null
  /** Inference metadata for UI ("WebGPU · 234 ms"). */
  lastInference: { backend: SegmentResult['backend']; durationMs: number } | null

  setFile: (file: File | null) => Promise<void>
  setMask: (mask: ImageData | null, meta?: SegmentResult) => void
  reset: () => void
}

async function decodeFile(file: File): Promise<ImageBitmap> {
  // createImageBitmap is the fastest, GPU-friendly decode path. Falls
  // back to URL.createObjectURL → <img> when unavailable (very old
  // browsers); not implemented here — modern browsers all support
  // direct File decode.
  return createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
}

export const useStudioStore = create<StudioState>((set, get) => ({
  file: null,
  bitmap: null,
  mask: null,
  lastInference: null,

  async setFile(file) {
    // Release any previous bitmap before swapping in a new one.
    const prev = get().bitmap
    if (prev) prev.close()

    if (!file) {
      set({ file: null, bitmap: null, mask: null, lastInference: null })
      return
    }

    let bitmap: ImageBitmap
    try {
      bitmap = await decodeFile(file)
    } catch (err) {
      set({ file: null, bitmap: null, mask: null, lastInference: null })
      throw err
    }
    set({ file, bitmap, mask: null, lastInference: null })
  },

  setMask(mask, meta) {
    set({
      mask,
      lastInference: meta ? { backend: meta.backend, durationMs: meta.durationMs } : null,
    })
  },

  reset() {
    const prev = get().bitmap
    if (prev) prev.close()
    set({ file: null, bitmap: null, mask: null, lastInference: null })
  },
}))

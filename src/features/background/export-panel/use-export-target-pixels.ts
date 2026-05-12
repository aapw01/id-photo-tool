'use client'

/**
 * Resolves the final export pixel size in three modes:
 *
 *   1. spec + frame, default behaviour      → spec's prescribed pixel box
 *      (e.g. 美国签证 → 602 × 602 @ 300 DPI). The spec wins because the
 *      printed photo has to land at the right physical size.
 *   2. spec + frame, `keepNativeResolution` → the frame's native pixel
 *      dimensions in the original-bitmap coord system. Same aspect as
 *      the spec, but a higher-resolution file (typical 1500–2500 px
 *      long side on a modern phone shot). Use when the user wants a
 *      large file at the spec ratio.
 *   3. neither spec nor frame              → the original bitmap size,
 *      i.e. "raw export" (no crop, no resize).
 *
 * Pure logic in `resolveExportTargetPixels`; thin `useMemo` wrapper in
 * `useExportTargetPixels` keeps the React side trivial.
 */

import { useMemo } from 'react'

import { derivePixels } from '@/lib/spec-units'
import type { CropFrame, PhotoSpec } from '@/types/spec'

export interface ExportTargetInput {
  bitmap: { width: number; height: number }
  spec?: PhotoSpec | null
  frame?: CropFrame | null
  keepNativeResolution: boolean
}

export interface ExportTargetPixels {
  width: number
  height: number
}

export function resolveExportTargetPixels({
  bitmap,
  spec,
  frame,
  keepNativeResolution,
}: ExportTargetInput): ExportTargetPixels {
  if (spec && frame) {
    if (keepNativeResolution) {
      return { width: Math.round(frame.w), height: Math.round(frame.h) }
    }
    const r = derivePixels(spec)
    return { width: r.width_px, height: r.height_px }
  }
  return { width: bitmap.width, height: bitmap.height }
}

export function useExportTargetPixels(input: ExportTargetInput): ExportTargetPixels {
  return useMemo(
    () => resolveExportTargetPixels(input),
    // The bitmap object identity changes on every replace so memoising
    // by width/height alone keeps the result stable across remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.bitmap.width, input.bitmap.height, input.spec, input.frame, input.keepNativeResolution],
  )
}

'use client'

/**
 * Owns the *cached* preview foreground (cut-out at the preview cap)
 * plus the one-shot escape hatch used when the export target exceeds
 * the cache resolution.
 *
 * Two outputs:
 *
 *   - `foreground` — the cached `ImageBitmap`, capped to
 *     `PREVIEW_FG_LONGSIDE_PX`. Rebuilds whenever `bitmap` / `mask`
 *     change; the previous bitmap is closed automatically. `null` when
 *     the user hasn't run segmentation yet.
 *   - `acquireFullRes(targetLongSide)` — async escape hatch. When the
 *     caller needs a sharper foreground (e.g. download at 3000 px), it
 *     builds a fresh cut-out *for that call only* and returns it as a
 *     `oneShot` ImageBitmap. The caller must `oneShot?.close()` when
 *     done. If the cached foreground is already large enough, the
 *     function returns `{ source: cached, oneShot: null }` — no
 *     allocation.
 *
 * Fast path: when the segmentation worker returns a precomputed
 * decontaminated `precomputedForeground` (P2-2), the preview cache is
 * built from that buffer directly — the main thread only pays for one
 * `createImageBitmap` call, never the alpha-matte + spill suppression
 * passes.
 */

import { useCallback, useEffect, useState } from 'react'

import { extractForegroundCapped } from '../composite'

/**
 * Long-side cap of the cached preview foreground. Has to match the
 * default used by `extractForegroundCapped` so the "do I need to
 * rebuild?" check agrees with what the preview effect actually
 * stashes.
 */
export const PREVIEW_FG_LONGSIDE_PX = 1600

export interface ExportForegroundApi {
  foreground: ImageBitmap | null
  acquireFullRes: (targetLongSide: number) => Promise<{
    source: ImageBitmap
    oneShot: ImageBitmap | null
  }>
}

export function useExportForeground(
  bitmap: ImageBitmap,
  mask: ImageData | null,
  precomputedForeground?: ImageData | null,
): ExportForegroundApi {
  const [foreground, setForeground] = useState<ImageBitmap | null>(null)

  useEffect(() => {
    let cancelled = false
    const work = async () => {
      // React 19: defer the setState past the synchronous effect body.
      await null
      if (cancelled) return
      if (!mask) {
        setForeground((prev) => {
          prev?.close?.()
          return null
        })
        return
      }
      // Fast path: the worker already produced a decontaminated RGBA
      // buffer at the preview cap. `createImageBitmap` from an
      // ImageData is the same cost as wrapping a freshly painted
      // canvas, so we skip ~200-400 ms of pixel work on 20MP captures.
      const fg = precomputedForeground
        ? await createImageBitmap(precomputedForeground)
        : await extractForegroundCapped(bitmap, mask)
      if (cancelled) {
        fg.close?.()
        return
      }
      setForeground((prev) => {
        prev?.close?.()
        return fg
      })
    }
    void work()
    return () => {
      cancelled = true
    }
  }, [bitmap, mask, precomputedForeground])

  const acquireFullRes = useCallback(
    async (targetLongSide: number) => {
      const cachedLong = foreground ? Math.max(foreground.width, foreground.height) : 0
      const needsFullRes = !!mask && targetLongSide > cachedLong
      if (!needsFullRes) {
        return { source: foreground ?? bitmap, oneShot: null as ImageBitmap | null }
      }
      // Add a small headroom so the resampler downscales (sharp)
      // rather than upscales (blurry) — matches `derivePixels`
      // rounding slop. The full-res path stays on the main thread:
      // it's only hit when the user opts into "native resolution",
      // which is rare enough that the worker round-trip + transfer
      // cost isn't worth it.
      const oneShot = await extractForegroundCapped(bitmap, mask!, {
        maxLongSide: Math.max(PREVIEW_FG_LONGSIDE_PX, Math.ceil(targetLongSide * 1.05)),
      })
      return { source: oneShot, oneShot }
    },
    [bitmap, mask, foreground],
  )

  return { foreground, acquireFullRes }
}

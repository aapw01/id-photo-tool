'use client'

/**
 * Side-effects that drive the crop tab.
 *
 * Responsibilities (one hook, one place, easy to reason about):
 *
 *   1. Lazy-fire MediaPipe face detection when the user opens the
 *      size tab for the first time on a given image. The result is
 *      cached on the crop store; we never run twice for the same
 *      bitmap.
 *
 *   2. Whenever the spec changes, run `autoCenter` to produce a fresh
 *      crop frame. Discards any previous user-drag — that's the
 *      contract: changing spec resets the frame.
 *
 *   3. Whenever the frame changes, recompute compliance warnings.
 *
 *   4. When the user picks a spec whose `background.recommended`
 *      differs from the current background, suggest applying it (one
 *      toast, one action — `Crop.bgSuggested`).
 *
 * The hook returns nothing; it's wired up imperatively by the Studio
 * workspace.
 */

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useBackgroundStore } from '@/features/background/store'
import type { I18nText } from '@/types/spec'

import { autoCenter } from './auto-center'
import { checkCompliance } from './compliance'
import { detectFace, FaceDetectError } from './face-detect'
import { useCropStore } from './spec-store'

/**
 * Wire the crop flow side-effects together.
 *
 * Pass the current image bitmap and whether the size tab is the active
 * one in Studio. The hook does the rest.
 */
export function useCropFlow(bitmap: ImageBitmap | null, sizeTabActive: boolean): void {
  const tCrop = useTranslations('Crop')
  const locale = useLocale() as keyof I18nText

  const spec = useCropStore((s) => s.spec)
  const frame = useCropStore((s) => s.frame)
  const face = useCropStore((s) => s.face)
  const detecting = useCropStore((s) => s.detecting)

  // Don't react to these in deps — we only need their setters.
  const { setFace, setFrame, setWarnings, setDetecting, setFaceError } = useCropStore.getState()

  const bgKind = useBackgroundStore((s) => s.current.kind)
  const setBgColor = useBackgroundStore((s) => s.setColor)

  /* -------------------------------------------------------------- */
  /* 1. Face detection                                              */
  /* -------------------------------------------------------------- */

  const detectedFor = useRef<ImageBitmap | null>(null)
  useEffect(() => {
    if (!bitmap || !sizeTabActive) return
    if (detectedFor.current === bitmap) return // already ran for this bitmap
    if (detecting) return

    detectedFor.current = bitmap
    setDetecting(true)
    setFaceError(null)

    let cancelled = false
    void (async () => {
      try {
        const result = await detectFace(bitmap)
        if (cancelled) return
        setFace(result)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof FaceDetectError ? err.message : String(err)
        setFaceError(msg)
        setFace(null)
      } finally {
        if (!cancelled) setDetecting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bitmap, sizeTabActive, detecting, setDetecting, setFace, setFaceError])

  /* -------------------------------------------------------------- */
  /* 2. autoCenter on spec change                                   */
  /* -------------------------------------------------------------- */

  // We track three things across renders:
  //   - `lastSpecId`     — which spec the current `frame` was computed for
  //   - `lastUsedFace`   — the face passed into the last autoCenter call
  //                        (so we can detect "face just arrived")
  //   - `lastAutoFrame`  — the exact frame autoCenter produced; if the
  //                        user has dragged, `frame` !== this value and
  //                        we won't clobber their work on face arrival.
  const lastSpecId = useRef<string | null>(null)
  const lastUsedFace = useRef<typeof face>(null)
  const lastAutoFrame = useRef<typeof frame>(null)

  useEffect(() => {
    if (!bitmap || !spec) {
      lastSpecId.current = null
      lastUsedFace.current = null
      lastAutoFrame.current = null
      return
    }
    const specChanged = lastSpecId.current !== spec.id
    const userDragged = frame !== null && frame !== lastAutoFrame.current
    const faceArrived = !!face && !lastUsedFace.current

    // Re-run on:
    //   - spec change (always)
    //   - first paint when no frame exists yet
    //   - face arriving for the first time, *if* the user hasn't
    //     dragged the auto-frame manually
    if (!specChanged && frame && !(faceArrived && !userDragged)) return

    lastSpecId.current = spec.id
    lastUsedFace.current = face
    // Don't gate on `detecting`: an initial centred-crop is more
    // useful than a perpetual spinner when the MediaPipe CDN is
    // unreachable. The effect re-fires once `face` resolves and
    // upgrades the frame in place.
    const next = autoCenter({ width: bitmap.width, height: bitmap.height }, spec, face)
    lastAutoFrame.current = next
    setFrame(next)
  }, [bitmap, spec, face, frame, setFrame])

  /* -------------------------------------------------------------- */
  /* 3. Recompute compliance whenever frame or face changes         */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!spec || !frame) {
      setWarnings([])
      return
    }
    const result = checkCompliance(frame, face, spec)
    setWarnings(result.warnings)
  }, [spec, frame, face, setWarnings])

  /* -------------------------------------------------------------- */
  /* 4. Apply spec.background.recommended when nothing's set        */
  /* -------------------------------------------------------------- */

  const bgAppliedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!spec?.background?.recommended) return
    if (bgAppliedFor.current === spec.id) return
    bgAppliedFor.current = spec.id

    // Only auto-apply if the user hasn't explicitly picked a colour
    // yet (i.e. they're still on the default transparent).
    if (bgKind !== 'transparent') return

    setBgColor({ kind: 'color', hex: spec.background.recommended })
    toast.success(
      tCrop('bgSuggested', {
        name: spec.name[locale] ?? spec.name.en,
      }),
    )
  }, [spec, bgKind, setBgColor, tCrop, locale])
}

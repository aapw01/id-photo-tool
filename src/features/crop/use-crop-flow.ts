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

import { useEffect, useLayoutEffect, useRef } from 'react'
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

  const lastSpecId = useRef<string | null>(null)
  const lastFaceRef = useRef(face)
  useLayoutEffect(() => {
    lastFaceRef.current = face
  }, [face])

  useEffect(() => {
    if (!bitmap || !spec) {
      lastSpecId.current = null
      return
    }
    // Re-run when spec changes OR when the face becomes available
    // after a spec was already chosen.
    if (lastSpecId.current === spec.id && frame) return
    if (detecting) return // wait for detection to settle

    lastSpecId.current = spec.id
    const next = autoCenter(
      { width: bitmap.width, height: bitmap.height },
      spec,
      lastFaceRef.current,
    )
    setFrame(next)
  }, [bitmap, spec, face, detecting, frame, setFrame])

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

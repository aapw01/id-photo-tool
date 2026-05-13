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

import { useEffect, useMemo, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useBackgroundStore } from '@/features/background/store'
import { useStudioStore } from '@/features/studio/store'
import { localizeText } from '@/lib/i18n-text'

import { autoCenter } from './auto-center'
import { checkCompliance } from './compliance'
import { detectFace, FaceDetectError } from './face-detect'
import { findHeadTopFromMask } from './head-top-from-mask'
import { useCropStore } from './spec-store'

/**
 * Wire the crop flow side-effects together.
 *
 * Pass the current image bitmap and whether the size tab is the active
 * one in Studio. The hook does the rest.
 */
export function useCropFlow(bitmap: ImageBitmap | null, sizeTabActive: boolean): void {
  const tCrop = useTranslations('Crop')
  const locale = useLocale()

  const spec = useCropStore((s) => s.spec)
  const frame = useCropStore((s) => s.frame)
  const frameSource = useCropStore((s) => s.frameSource)
  const face = useCropStore((s) => s.face)
  const detecting = useCropStore((s) => s.detecting)

  // Production studio pegs the head-size bias to the upper bound of
  // the spec's allowed band so the head fills the frame — that's the
  // result users overwhelmingly expect for ID photos. The UI used to
  // surface a slider, but it felt fiddly without changing the picture
  // much; we now keep the value fixed and let the existing crop frame
  // handles cover the rare "I want more headroom" case.
  const HEAD_SIZE_BIAS = 1

  // Don't react to these in deps — we only need their setters.
  const { setFace, setFrame, setWarnings, setDetecting, setFaceError } = useCropStore.getState()

  const bgKind = useBackgroundStore((s) => s.current.kind)
  const setBgColor = useBackgroundStore((s) => s.setColor)

  // The matting mask, when available, gives us pixel-accurate
  // head-top coordinates — hair-, hat-, and bun-aware. Compute it
  // once per (mask, face) pair so the heavy scan doesn't run on
  // every slider change.
  const mask = useStudioStore((s) => s.mask)
  const headTopY = useMemo(() => {
    if (!mask || !bitmap || !face) return undefined
    const value = findHeadTopFromMask(mask, bitmap.width, bitmap.height, face)
    return value ?? undefined
  }, [mask, bitmap, face])

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
  /* 2. autoCenter — driven by an explicit state machine            */
  /* -------------------------------------------------------------- */
  //
  // The frame's provenance now lives on the store as `frameSource`:
  //
  //   - `'auto'` → safe to recompute on any better signal (face,
  //                headTop, spec). The auto-pass owns the frame.
  //   - `'user'` → manual drag / keyboard nudge. Only a *fresh user
  //                intent* — spec change — gets to overwrite. Face /
  //                headTop "free upgrades" leave the locked frame alone.
  //
  // We compute a `key` per the relevant auto-pass inputs and only
  // act when it changes. That keeps the effect from re-firing when
  // it writes back its own result (the write changes `frame` /
  // `frameSource` but not the key).
  const autoKey = useMemo(
    () =>
      `${spec?.id ?? '∅'}|${face?.bbox.x.toFixed(1) ?? '∅'},${face?.bbox.y.toFixed(1) ?? '∅'}|${
        headTopY?.toFixed(1) ?? '∅'
      }`,
    [spec, face, headTopY],
  )
  const lastAutoKey = useRef<string | null>(null)
  const lastAutoSpecId = useRef<string | null>(null)

  useEffect(() => {
    if (!bitmap || !spec) return
    if (autoKey === lastAutoKey.current) return

    const specChanged = lastAutoSpecId.current !== spec.id
    const userOwnsFrame = frameSource === 'user'

    // User-owned frames stay put unless the user changed spec
    // (the only "fresh intent" trigger remaining). Face / headTop
    // refinements arrive after the user might have already nudged —
    // clobbering their work would be infuriating.
    if (userOwnsFrame && !specChanged) {
      // Record what we saw so the next signal change is judged
      // against current inputs — otherwise a later face-only refine
      // would still register as "spec changed".
      lastAutoKey.current = autoKey
      lastAutoSpecId.current = spec.id
      return
    }

    lastAutoKey.current = autoKey
    lastAutoSpecId.current = spec.id
    // Don't gate on `detecting`: an initial centred-crop is more
    // useful than a perpetual spinner when the MediaPipe CDN is
    // unreachable. The effect re-fires once `face` resolves and
    // upgrades the frame in place.
    const next = autoCenter({ width: bitmap.width, height: bitmap.height }, spec, face, {
      headTopY,
      headSizeBias: HEAD_SIZE_BIAS,
    })
    setFrame(next, 'auto')
  }, [autoKey, bitmap, spec, face, frameSource, setFrame, headTopY])

  /* -------------------------------------------------------------- */
  /* 3. Recompute compliance whenever frame or face changes         */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!spec || !frame) {
      setWarnings([])
      return
    }
    const result = checkCompliance(frame, face, spec, { headTopY })
    setWarnings(result.warnings)
  }, [spec, frame, face, setWarnings, headTopY])

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
        name: localizeText(spec.name, locale),
      }),
    )
  }, [spec, bgKind, setBgColor, tCrop, locale])
}

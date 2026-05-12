'use client'

/**
 * Idle-time model prewarm for hover-capable devices.
 *
 * On a desktop with a pointer (`(hover: hover)` matches), we kick off
 * `useSegmentation().warmup()` either at the next `requestIdleCallback`
 * or as soon as the user hovers any element tagged with the
 * `data-warmup-segmentation` attribute (whichever comes first).
 *
 * On mobile / touch we deliberately do nothing — the 6 MB download
 * would burn cellular data without the user actually opening Studio.
 * Their warmup happens when they actually navigate to /studio
 * (M2-T16).
 *
 * Render this once near the root of any page where prewarm makes sense
 * (currently: the home hero). It produces no DOM and is safe to remount
 * — the underlying segmentation client is a singleton.
 */

import { useEffect } from 'react'

import { useSegmentation } from './use-segmentation'

type IdleCallbackWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
}

const PREWARM_DELAY_MS = 1500
const PREWARM_IDLE_TIMEOUT = 4000

export function SegmentationPrewarm() {
  const { warmup, state } = useSegmentation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Skip on touch-only devices; downloading 6 MB without a clear
    // intent is a poor experience on cellular.
    const hasHover = window.matchMedia('(hover: hover)').matches
    if (!hasHover) return

    // Already warm — nothing to do.
    if (state === 'ready' || state === 'inferring') return

    let cancelled = false
    let idleId: number | undefined
    let timeoutId: number | undefined

    function trigger() {
      if (cancelled) return
      void warmup()
    }

    const idleWin = window as unknown as IdleCallbackWindow
    if (typeof idleWin.requestIdleCallback === 'function') {
      idleId = idleWin.requestIdleCallback(trigger, { timeout: PREWARM_IDLE_TIMEOUT })
    } else {
      timeoutId = window.setTimeout(trigger, PREWARM_DELAY_MS)
    }

    // Hover on any opt-in element warms up immediately (e.g. CTA).
    const hoverElements = document.querySelectorAll('[data-warmup-segmentation]')
    function onHover() {
      trigger()
      hoverElements.forEach((el) => el.removeEventListener('pointerenter', onHover))
      hoverElements.forEach((el) => el.removeEventListener('focus', onHover, true))
    }
    hoverElements.forEach((el) => el.addEventListener('pointerenter', onHover, { once: true }))
    hoverElements.forEach((el) =>
      el.addEventListener('focus', onHover, { capture: true, once: true }),
    )

    return () => {
      cancelled = true
      if (idleId !== undefined && typeof idleWin.cancelIdleCallback === 'function') {
        idleWin.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      hoverElements.forEach((el) => el.removeEventListener('pointerenter', onHover))
      hoverElements.forEach((el) => el.removeEventListener('focus', onHover, true))
    }
  }, [warmup, state])

  return null
}

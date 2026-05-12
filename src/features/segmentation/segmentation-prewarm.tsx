'use client'

/**
 * Conditional model prewarm for hover-capable devices.
 *
 * Triggers (any of the below, on a `(hover: hover)` device, once):
 *
 *   - The user hovers / focuses any element tagged with the
 *     `data-warmup-segmentation` attribute (e.g. the background tab's
 *     "Start cut-out" CTA).
 *   - The studio tab store reports the user already visited the
 *     background tab in this session — they've shown intent to cut out.
 *   - `idle` prop is set AND `requestIdleCallback` fires (opt-in:
 *     only pass `idle` from a place that has clear cut-out intent).
 *
 * On mobile / touch we deliberately do nothing — the 6 MB download
 * would burn cellular data without explicit user action. The
 * background panel's explicit CTA covers that path.
 *
 * Render this once on the studio page so the model is ready when the
 * user opens the background tab. Produces no DOM and is safe to
 * remount — the underlying segmentation client is a singleton.
 */

import { useEffect } from 'react'

import { useStudioTabStore } from '@/features/studio/studio-tab-store'

import { useSegmentation } from './use-segmentation'

interface SegmentationPrewarmProps {
  /**
   * When true, schedule the warmup via `requestIdleCallback` even
   * without an explicit hover / visit. Use sparingly — only on
   * surfaces where the user has clearly indicated they intend to run
   * segmentation. Defaults to `false`.
   */
  idle?: boolean
}

type IdleCallbackWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
}

const PREWARM_DELAY_MS = 1500
const PREWARM_IDLE_TIMEOUT = 4000

export function SegmentationPrewarm({ idle = false }: SegmentationPrewarmProps = {}) {
  const { warmup, state } = useSegmentation()
  // Subscribe so a tab change during the session retriggers the
  // effect; we read `visited` again inside the body to make the gate
  // explicit.
  const visited = useStudioTabStore((s) => s.visited)

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

    // Path 1: user already opened the background tab this session.
    // Treat that as "clear intent" and warm up immediately on the
    // next microtask.
    if (visited.has('background')) {
      queueMicrotask(trigger)
    }

    // Path 2: idle prewarm — opt-in via prop, scheduled on the
    // browser's idle callback so we never compete with first paint.
    const idleWin = window as unknown as IdleCallbackWindow
    if (idle) {
      if (typeof idleWin.requestIdleCallback === 'function') {
        idleId = idleWin.requestIdleCallback(trigger, { timeout: PREWARM_IDLE_TIMEOUT })
      } else {
        timeoutId = window.setTimeout(trigger, PREWARM_DELAY_MS)
      }
    }

    // Path 3: hover / focus on any opt-in element triggers immediately.
    // The CTA in the background panel is the canonical hook.
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
  }, [warmup, state, idle, visited])

  return null
}

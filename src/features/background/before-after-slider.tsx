'use client'

/**
 * Before / after comparison slider.
 *
 * Two children stacked absolutely on top of each other. A vertical
 * divider in the middle is draggable; dragging adjusts the top
 * layer's `clip-path: inset(...)` so the original ("before") shows
 * through on the left and the composited ("after") on the right.
 *
 * Pointer events cover mouse + touch + stylus uniformly thanks to
 * the Pointer Events spec. Keyboard arrows on the divider move 2%
 * per press (Shift = 10%).
 *
 * The actual content is supplied by the parent — typically two
 * canvases — so this component stays presentational.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface BeforeAfterSliderProps {
  before: React.ReactNode
  after: React.ReactNode
  /** ARIA label for the divider thumb. */
  thumbLabel?: string
  className?: string
}

const STEP = 2
const SHIFT_STEP = 10

export function BeforeAfterSlider({
  before,
  after,
  thumbLabel = 'Drag to compare',
  className,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<number | null>(null) // pointerId being tracked
  const [pct, setPct] = useState(50)

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const raw = ((clientX - rect.left) / rect.width) * 100
    setPct(Math.min(100, Math.max(0, raw)))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== null) return
      draggingRef.current = e.pointerId
      e.currentTarget.setPointerCapture(e.pointerId)
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current !== e.pointerId) return
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current !== e.pointerId) return
    draggingRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released — fine
    }
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? SHIFT_STEP : STEP
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPct((p) => Math.max(0, p - step))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPct((p) => Math.min(100, p + step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPct(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPct(100)
    }
  }, [])

  // Reset to centre if the slot resizes from 0 (e.g. tab becomes visible).
  useEffect(() => {
    if (containerRef.current?.offsetWidth === 0) setPct(50)
  }, [])

  return (
    <div
      ref={containerRef}
      className={['relative isolate overflow-hidden select-none', className]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* "before" sits at the bottom */}
      <div className="relative">{before}</div>

      {/* "after" sits on top, clipped to the right side */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
      >
        {after}
      </div>

      {/* Divider */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10"
        style={{ left: `calc(${pct}% - 1px)` }}
      >
        <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" />
      </div>

      {/* Thumb (keyboard focusable) */}
      <div
        role="slider"
        aria-label={thumbLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-[var(--color-border)] bg-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        style={{ left: `${pct}%` }}
      >
        <ThumbIcon />
      </div>
    </div>
  )
}

function ThumbIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 3.5L2 7l3 3.5M9 3.5L12 7l-3 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

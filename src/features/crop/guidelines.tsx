'use client'

/**
 * Composition guideline overlay.
 *
 * Three horizontal lines drawn inside the crop frame:
 *   - head top      (frame_top + frame_h × (1 - headHeightRatio_mid - eyeFromTop_mid))
 *   - eye line      (frame_top + frame_h × eyeFromTop_mid)
 *   - chin          (frame_top + frame_h × (eyeFromTop_mid + headHeightRatio_mid))
 *
 * Lines use SVG so they remain crisp at any zoom level. The container
 * is `position: absolute; inset: 0` and uses % coordinates relative
 * to the image — which means it sits in the same coordinate system
 * as `CropFrameOverlay`.
 *
 * The overlay is purely visual: it never intercepts pointer events.
 */

import type { CropFrame, PhotoSpec } from '@/types/spec'

interface GuidelinesProps {
  imageW: number
  imageH: number
  spec: PhotoSpec | null
  frame: CropFrame | null
}

const DEFAULT_HEAD_RATIO = 0.65
const DEFAULT_EYE_FROM_TOP = 0.38

const mid = (band?: readonly [number, number]) => (band ? (band[0] + band[1]) / 2 : undefined)

export function Guidelines({ imageW, imageH, spec, frame }: GuidelinesProps) {
  if (!spec || !frame || imageW <= 0 || imageH <= 0) return null

  const headRatio = mid(spec.composition?.headHeightRatio) ?? DEFAULT_HEAD_RATIO
  const eyeFromTop = mid(spec.composition?.eyeLineFromTop) ?? DEFAULT_EYE_FROM_TOP

  const eyeY = frame.y + frame.h * eyeFromTop
  // headRatio is head_height / frame_height. eye sits ~37% from the
  // top of the head, so we approximate forehead and chin from the eye:
  const headHeight = frame.h * headRatio
  const foreheadY = eyeY - headHeight * 0.37
  const chinY = eyeY + headHeight * 0.63

  // Convert to viewBox coords (% × 100 for SVG precision).
  const toPctX = (px: number) => (px / imageW) * 100
  const toPctY = (px: number) => (px / imageH) * 100

  const x1 = toPctX(frame.x)
  const x2 = toPctX(frame.x + frame.w)

  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <Line label="head" y={toPctY(foreheadY)} x1={x1} x2={x2} />
      <Line label="eye" y={toPctY(eyeY)} x1={x1} x2={x2} primary />
      <Line label="chin" y={toPctY(chinY)} x1={x1} x2={x2} />
    </svg>
  )
}

function Line({
  label,
  y,
  x1,
  x2,
  primary,
}: {
  label: string
  y: number
  x1: number
  x2: number
  primary?: boolean
}) {
  return (
    <g>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={primary ? 'rgba(16, 185, 129, 0.95)' : 'rgba(16, 185, 129, 0.6)'}
        strokeWidth={primary ? 0.3 : 0.2}
        strokeDasharray={primary ? '0' : '0.6 0.6'}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={x1 + 0.5}
        y={y - 0.3}
        fontSize="1.6"
        fill="rgba(16, 185, 129, 0.95)"
        fontFamily="var(--font-jetbrains-mono), monospace"
        vectorEffect="non-scaling-stroke"
      >
        {label}
      </text>
    </g>
  )
}

'use client'

/**
 * Inline 4-corner editor.
 *
 * Renders the source bitmap (via its blob URL) inside a container,
 * overlays an SVG with 4 draggable circular handles + a polygon
 * connecting them, and reports the user-edited `Quad` on apply.
 *
 * Coordinate model:
 *
 *   - SVG `viewBox` is the bitmap's native pixel rect, so each handle
 *     position maps 1:1 to a source pixel — the parent passes the
 *     resulting `Quad` straight into the rectify pipeline.
 *   - Pointer events convert client-space coordinates back into
 *     viewBox space via `getCTM().inverse()` — keeps the math
 *     resolution-independent and matches the visual position of the
 *     handles whatever the container is sized at.
 *
 * Pointer events (not mousedown/touchstart): single code path covers
 * mouse, pen, and touch — which is mandatory because the Scanner is
 * mobile-first.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, RotateCcw, X } from 'lucide-react'

import type { Quad, QuadPoint } from '../lib/detect-corners'
import { orderClockwise } from '../lib/detect-corners'
import type { ScannerSlot } from '../store'

type Handle = keyof Quad

const HANDLE_ORDER: readonly Handle[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
] as const

interface ScannerCornerEditorProps {
  slot: ScannerSlot
  /** Initial corner positions (defaults to the slot's last detected quad). */
  initial: Quad
  onApply: (quad: Quad) => void
  onCancel: () => void
  /** Re-run auto-detection (clears overrides). */
  onResetToDetected: () => void
}

export function ScannerCornerEditor({
  slot,
  initial,
  onApply,
  onCancel,
  onResetToDetected,
}: ScannerCornerEditorProps) {
  const t = useTranslations('Scanner.editor')
  const svgRef = useRef<SVGSVGElement>(null)
  const [quad, setQuad] = useState<Quad>(initial)
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null)
  const previewUrl = useBlobUrl(slot.blob)

  // Sync external resets (e.g. user clicked "reset to auto-detect").
  useEffect(() => {
    setQuad(initial)
  }, [initial])

  const toViewBox = useCallback(
    (clientX: number, clientY: number): QuadPoint | null => {
      const svg = svgRef.current
      if (!svg) return null
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const local = pt.matrixTransform(ctm.inverse())
      return {
        x: clamp(local.x, 0, slot.bitmap.width),
        y: clamp(local.y, 0, slot.bitmap.height),
      }
    },
    [slot.bitmap.width, slot.bitmap.height],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!activeHandle) return
      const next = toViewBox(e.clientX, e.clientY)
      if (!next) return
      setQuad((q) => ({ ...q, [activeHandle]: next }))
    },
    [activeHandle, toViewBox],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeHandle) {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      }
      setActiveHandle(null)
    },
    [activeHandle],
  )

  const handleApply = () => {
    // Re-order in case the user dragged a handle past another
    // (a common accident on touch). The rectify pipeline expects
    // TL → TR → BR → BL.
    const reordered = orderClockwise([
      quad.topLeft,
      quad.topRight,
      quad.bottomRight,
      quad.bottomLeft,
    ])
    onApply(reordered)
  }

  /**
   * Keyboard accessibility for the 4 corner handles. Each handle is
   * focusable (`tabIndex=0`) so screen-reader users / keyboard-only
   * users can step through TL → TR → BR → BL. Arrow keys nudge by 1
   * source-bitmap pixel, Shift+arrow by 10 — same convention as the
   * Studio crop frame.
   */
  const handleKeyDown = (key: Handle) => (e: React.KeyboardEvent<SVGCircleElement>) => {
    const stepLarge = 10
    const stepSmall = 1
    const stride = e.shiftKey ? stepLarge : stepSmall
    let dx = 0
    let dy = 0
    switch (e.key) {
      case 'ArrowLeft':
        dx = -stride
        break
      case 'ArrowRight':
        dx = stride
        break
      case 'ArrowUp':
        dy = -stride
        break
      case 'ArrowDown':
        dy = stride
        break
      default:
        return
    }
    e.preventDefault()
    setQuad((q) => {
      const p = q[key]
      return {
        ...q,
        [key]: {
          x: clamp(p.x + dx, 0, slot.bitmap.width),
          y: clamp(p.y + dy, 0, slot.bitmap.height),
        },
      }
    })
  }

  const handleRadiusVB = computeHandleRadius(slot.bitmap)

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h3>
        <p className="text-xs text-[var(--color-text-mute)]">{t('hint')}</p>
      </div>

      <div className="relative w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-divider)]/30">
        {previewUrl && (
          // Source image — blob URL, no next/image (see scanner-upload-card)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="block h-auto w-full" draggable={false} />
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${slot.bitmap.width} ${slot.bitmap.height}`}
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 h-full w-full touch-none"
        >
          <polygon
            points={[quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill="rgba(16,185,129,0.15)"
            stroke="rgb(16,185,129)"
            strokeWidth={Math.max(2, handleRadiusVB * 0.2)}
            vectorEffect="non-scaling-stroke"
          />
          {HANDLE_ORDER.map((key) => {
            const p = quad[key]
            return (
              <circle
                key={key}
                cx={p.x}
                cy={p.y}
                r={handleRadiusVB}
                fill="white"
                stroke="rgb(5,150,105)"
                strokeWidth={Math.max(2, handleRadiusVB * 0.15)}
                vectorEffect="non-scaling-stroke"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  setActiveHandle(key)
                }}
                onKeyDown={handleKeyDown(key)}
                tabIndex={0}
                className="cursor-grab focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:cursor-grabbing"
                role="slider"
                aria-label={t(`handles.${key}` as Parameters<typeof t>[0])}
                aria-valuetext={`${Math.round(p.x)}, ${Math.round(p.y)}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(slot.bitmap.width, slot.bitmap.height)}
                aria-valuenow={Math.round(p.x)}
              />
            )
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onResetToDetected}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t('reset')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-divider)]"
          >
            <X className="size-3.5" aria-hidden="true" />
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
          >
            <Check className="size-3.5" aria-hidden="true" />
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Handle radius — sized in source-bitmap pixels so the visual
 * footprint stays roughly the same regardless of container width
 * (because we set `vectorEffect="non-scaling-stroke"` on the strokes
 * but the circle radius does scale with the SVG; sizing it to ~1.5%
 * of the long edge gives us a comfortable touch target at typical
 * preview sizes).
 */
function computeHandleRadius(bitmap: ImageBitmap): number {
  return Math.max(8, Math.min(bitmap.width, bitmap.height) * 0.015)
}

function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

'use client'

/**
 * Interactive crop frame.
 *
 * Renders an absolutely-positioned overlay on top of the studio
 * preview. The frame keeps the spec's aspect ratio: dragging any of
 * the four corners resizes both axes proportionally; dragging the
 * body moves the frame; arrow keys nudge it pixel-by-pixel.
 *
 * Coordinates live in *image pixel space* — the same space used by
 * `auto-center` and `compliance`. The parent passes the display
 * width / height of its canvas in CSS pixels so we can map pointer
 * deltas back into image pixels.
 *
 * The component is fully controlled: it never holds the frame in
 * local state. The store is the source of truth.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { aspectRatio } from '@/lib/spec-units'
import { cn } from '@/lib/utils'
import type { CropFrame, PhotoSpec } from '@/types/spec'

interface CropFrameProps {
  /** Image dimensions in pixels. Defines the coordinate system. */
  imageW: number
  imageH: number
  spec: PhotoSpec
  frame: CropFrame
  onChange: (next: CropFrame) => void
  /**
   * When true the overlay renders as a static visual outline:
   * - pointer interactions are disabled (no drag / resize)
   * - corner handles are hidden
   * - keyboard nudges are skipped
   * Used on the Export tab to remind the user their crop is still
   * applied without letting them edit it from there.
   */
  readOnly?: boolean
}

type DragKind = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface DragState {
  kind: DragKind
  pointerId: number
  originX: number
  originY: number
  startFrame: CropFrame
  /** Image-pixel ratio of the container, computed once on drag start. */
  scaleX: number
  scaleY: number
}

const MIN_FRAME_PX = 40

export function CropFrameOverlay({
  imageW,
  imageH,
  spec,
  frame,
  onChange,
  readOnly = false,
}: CropFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const aspect = aspectRatio(spec)

  const clampToImage = useCallback(
    (f: CropFrame): CropFrame => {
      const minW = Math.max(MIN_FRAME_PX, MIN_FRAME_PX * aspect)
      const minH = minW / aspect

      let w = Math.max(minH * aspect, Math.min(f.w, imageW))
      let h = w / aspect
      if (h > imageH) {
        h = imageH
        w = h * aspect
      }
      let x = Math.max(0, Math.min(f.x, imageW - w))
      let y = Math.max(0, Math.min(f.y, imageH - h))
      // Cope with floating-point drift when the frame brushes the edge.
      if (x + w > imageW) x = imageW - w
      if (y + h > imageH) y = imageH - h
      return { x, y, w, h }
    },
    [imageW, imageH, aspect],
  )

  const beginDrag = useCallback(
    (kind: DragKind, e: React.PointerEvent<HTMLElement>) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget as HTMLElement
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // some test environments don't implement pointer capture
      }
      dragRef.current = {
        kind,
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        startFrame: frame,
        scaleX: imageW / rect.width,
        scaleY: imageH / rect.height,
      }
    },
    [frame, imageW, imageH],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dxScreen = e.clientX - drag.originX
      const dyScreen = e.clientY - drag.originY
      // Translate to image-pixel deltas. Keep both axes scaled
      // identically so the aspect stays locked.
      const dxI = dxScreen * drag.scaleX
      const dyI = dyScreen * drag.scaleY

      const start = drag.startFrame
      let next: CropFrame

      if (drag.kind === 'move') {
        next = { ...start, x: start.x + dxI, y: start.y + dyI }
      } else {
        // Corner resize. We pick whichever axis (dx or dy) demands the
        // larger change so the frame "follows" the slowest finger,
        // then derive the other axis from the aspect ratio.
        const dirX = drag.kind === 'ne' || drag.kind === 'se' ? 1 : -1
        const dirY = drag.kind === 'sw' || drag.kind === 'se' ? 1 : -1

        const targetDw = dxI * dirX
        const targetDh = dyI * dirY
        const dw = Math.max(targetDw, targetDh * aspect)
        const dh = dw / aspect

        let x = start.x
        let y = start.y
        if (dirX < 0) x = start.x - dw
        if (dirY < 0) y = start.y - dh
        const w = start.w + dw
        const h = start.h + dh

        next = { x, y, w, h }
      }

      onChangeRef.current(clampToImage(next))
    },
    [aspect, clampToImage],
  )

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // tolerate "InvalidStateError" when capture was lost
    }
    dragRef.current = null
  }, [])

  // Keep frame inside the image whenever the spec / image size changes.
  useEffect(() => {
    const fixed = clampToImage(frame)
    if (fixed.x !== frame.x || fixed.y !== frame.y || fixed.w !== frame.w || fixed.h !== frame.h) {
      onChangeRef.current(fixed)
    }
  }, [clampToImage, frame])

  const keyHandler = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const m = moves[e.key]
      if (!m) return
      e.preventDefault()
      onChangeRef.current(clampToImage({ ...frame, x: frame.x + m[0]!, y: frame.y + m[1]! }))
    },
    [frame, clampToImage, readOnly],
  )

  const xPct = (frame.x / imageW) * 100
  const yPct = (frame.y / imageH) * 100
  const wPct = (frame.w / imageW) * 100
  const hPct = (frame.h / imageH) * 100

  // Read-only renders a softer dim mask so the underlying image stays
  // legible; the interactive variant uses the original heavier dim so
  // the crop window pops while the user is editing it.
  const dimColor = readOnly ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.35)'

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {/* dim mask */}
      <div
        className={cn('absolute inset-0', readOnly ? 'bg-black/20' : 'bg-black/35')}
        aria-hidden
      />

      {/* clear cutout for the frame using two overlapping divs: the
          shadow div sits underneath at the frame position with a
          large box-shadow that "punches" a hole in the dim mask. */}
      <div
        className="absolute"
        style={{
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${wPct}%`,
          height: `${hPct}%`,
          boxShadow: `0 0 0 99999px ${dimColor}`,
          mixBlendMode: 'normal',
        }}
        aria-hidden
      />

      {/* The actual interactive frame */}
      <div
        role={readOnly ? 'presentation' : 'application'}
        tabIndex={readOnly ? -1 : 0}
        onKeyDown={keyHandler}
        className={cn(
          'absolute border-2 border-[var(--color-primary)] outline-none',
          readOnly
            ? 'pointer-events-none'
            : 'pointer-events-auto cursor-move focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
        )}
        style={{
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${wPct}%`,
          height: `${hPct}%`,
          touchAction: readOnly ? 'auto' : 'none',
        }}
        onPointerDown={readOnly ? undefined : (e) => beginDrag('move', e)}
        onPointerMove={readOnly ? undefined : onPointerMove}
        onPointerUp={readOnly ? undefined : endDrag}
        onPointerCancel={readOnly ? undefined : endDrag}
      >
        {/* Rule-of-thirds grid for visual guidance */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-1/3 h-px bg-[rgba(255,255,255,0.4)]" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-[rgba(255,255,255,0.4)]" />
          <div className="absolute inset-y-0 left-1/3 w-px bg-[rgba(255,255,255,0.4)]" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-[rgba(255,255,255,0.4)]" />
          {/* Center axis — emphasises true centre over the rule-of-thirds. */}
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-px border-t border-dashed border-[rgba(255,255,255,0.7)]"
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-px border-l border-dashed border-[rgba(255,255,255,0.7)]"
            aria-hidden
          />
        </div>

        {readOnly ? null : (
          <CornerHandles beginDrag={beginDrag} onPointerMove={onPointerMove} endDrag={endDrag} />
        )}
      </div>
    </div>
  )
}

interface CornerHandlesProps {
  beginDrag: (kind: DragKind, e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  endDrag: (e: React.PointerEvent<HTMLElement>) => void
}

/**
 * The four corner resize handles. Lifted out of `CropFrameOverlay` so
 * the inline `beginDrag(corner, …)` arrow is no longer nested inside a
 * conditional ternary; the React refs lint rule was flagging that
 * shape as "ref read during render" when in fact it's only invoked on
 * pointer events.
 */
function CornerHandles({ beginDrag, onPointerMove, endDrag }: CornerHandlesProps) {
  return (
    <>
      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
        <button
          key={corner}
          type="button"
          aria-label={`resize-${corner}`}
          data-corner={corner}
          onPointerDown={(e) => beginDrag(corner, e)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ touchAction: 'none' }}
          className={cn(
            // 44×44 invisible hit area, centred on the corner — meets
            // WCAG / iOS touch-target minima. The visual handle is a
            // smaller pseudo-element drawn via the `before` utility.
            'absolute flex size-11 items-center justify-center bg-transparent p-0',
            'before:block before:size-3 before:rounded-full before:border-2 before:border-[var(--color-primary)] before:bg-white before:shadow-sm before:content-[""]',
            '[@media(pointer:coarse)]:before:size-4',
            corner === 'nw' && '-top-[22px] -left-[22px] cursor-nwse-resize',
            corner === 'ne' && '-top-[22px] -right-[22px] cursor-nesw-resize',
            corner === 'sw' && '-bottom-[22px] -left-[22px] cursor-nesw-resize',
            corner === 'se' && '-right-[22px] -bottom-[22px] cursor-nwse-resize',
          )}
        />
      ))}
    </>
  )
}

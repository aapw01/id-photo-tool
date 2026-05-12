/**
 * Crop-mark renderer for the layout module.
 *
 * Two flavours:
 *
 *   - `drawCutGuides(ctx, paper, dpi, cells)` draws short tick marks
 *     at every cell's four corners on a 2D canvas. Used by the raster
 *     preview + PNG export.
 *
 *   - `drawSeparator(ctx, x_mm, y_mm, w_mm, h_mm, dpi)` draws a single
 *     thin border around a cell. Print-shops use these to guide the
 *     paper cutter; they're visually subtle (1 px gray) so they don't
 *     fight with the photo.
 *
 * Coordinates come in millimetres; this module owns the mm→px
 * conversion so callers don't have to repeat it.
 */

import { mmToPx } from '@/lib/spec-units'
import type { Cell, PaperSpec, PhotoSpec } from '@/types/spec'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const TICK_LENGTH_MM = 4
const TICK_COLOR = 'rgba(0, 0, 0, 0.6)'
const SEPARATOR_COLOR = 'rgba(0, 0, 0, 0.18)'

interface ResolvedCell {
  cell: Cell
  spec: PhotoSpec
}

/**
 * Draw a corner tick at every cell. Ticks extend `TICK_LENGTH_MM` mm
 * past each corner so the line is visible even when cells touch.
 */
export function drawCutGuides(
  ctx: Ctx,
  paper: PaperSpec,
  cells: ResolvedCell[],
  dpi: number = paper.dpi,
): void {
  const tick = mmToPx(TICK_LENGTH_MM, dpi)
  ctx.save()
  ctx.strokeStyle = TICK_COLOR
  ctx.lineWidth = Math.max(1, Math.round(dpi / 300))

  for (const { cell, spec } of cells) {
    const rotated = cell.rotation === 90 || cell.rotation === 270
    const cellW = rotated ? spec.height_mm : spec.width_mm
    const cellH = rotated ? spec.width_mm : spec.height_mm
    const x = mmToPx(cell.x_mm, dpi)
    const y = mmToPx(cell.y_mm, dpi)
    const w = mmToPx(cellW, dpi)
    const h = mmToPx(cellH, dpi)

    // Top-left.
    drawCorner(ctx, x, y, -tick, -tick)
    // Top-right.
    drawCorner(ctx, x + w, y, +tick, -tick)
    // Bottom-left.
    drawCorner(ctx, x, y + h, -tick, +tick)
    // Bottom-right.
    drawCorner(ctx, x + w, y + h, +tick, +tick)
  }
  ctx.restore()
}

function drawCorner(ctx: Ctx, x: number, y: number, dx: number, dy: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dx, y)
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + dy)
  ctx.stroke()
}

/**
 * Outline a single cell with a faint gray border. Drawn after the
 * photo so the line sits on top.
 */
export function drawSeparator(
  ctx: Ctx,
  x_mm: number,
  y_mm: number,
  w_mm: number,
  h_mm: number,
  dpi: number,
): void {
  const x = mmToPx(x_mm, dpi)
  const y = mmToPx(y_mm, dpi)
  const w = mmToPx(w_mm, dpi)
  const h = mmToPx(h_mm, dpi)
  ctx.save()
  ctx.strokeStyle = SEPARATOR_COLOR
  ctx.lineWidth = Math.max(1, Math.round(dpi / 300))
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.restore()
}

/**
 * Mirror of `drawCutGuides` but for PDF output. jsPDF draws in mm
 * directly, so we don't need to convert. Callers pass the jsPDF
 * `doc` plus the resolved cells.
 */
export function drawPdfCutGuides(
  doc: { line: (x1: number, y1: number, x2: number, y2: number) => void },
  cells: ResolvedCell[],
): void {
  const tick = TICK_LENGTH_MM
  for (const { cell, spec } of cells) {
    const rotated = cell.rotation === 90 || cell.rotation === 270
    const w = rotated ? spec.height_mm : spec.width_mm
    const h = rotated ? spec.width_mm : spec.height_mm
    const x = cell.x_mm
    const y = cell.y_mm
    doc.line(x, y, x - tick, y)
    doc.line(x, y, x, y - tick)
    doc.line(x + w, y, x + w + tick, y)
    doc.line(x + w, y, x + w, y - tick)
    doc.line(x, y + h, x - tick, y + h)
    doc.line(x, y + h, x, y + h + tick)
    doc.line(x + w, y + h, x + w + tick, y + h)
    doc.line(x + w, y + h, x + w, y + h + tick)
  }
}

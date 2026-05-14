'use client'

/**
 * Pack one or two rectified document images onto a single paper
 * sheet (A4 / Letter / A5, portrait), ready for PDF embed or PNG
 * export.
 *
 * Decisions:
 *
 *   - **Portrait at 300 DPI**. A4 (210 × 297 mm), Letter (215.9 ×
 *     279.4 mm) and A5 (148 × 210 mm) supported in V1.
 *   - **Native print scale**: each card is drawn at its physical
 *     dimensions (`docSpec.widthMm × heightMm`), not stretched to
 *     fill the page. That keeps a printout the right physical size
 *     for staple-on-a-folder use.
 *   - **Stacked in the upper half** with a small mm gap between
 *     cards. The PRC ID-card workflow (front + back stacked) is the
 *     canonical use case; the lower half is left blank so the user
 *     can sign / annotate. Cut marks at each card's corners.
 *   - **White background** — explicitly painted so PDF/JPEG re-
 *     encoders don't surprise us with transparency artifacts.
 */

import { getOutputPixels, type DocSpec } from './doc-specs'

export type PaperSize = 'a4' | 'letter' | 'a5'

export interface PaperDimensions {
  widthMm: number
  heightMm: number
}

export const PAPER_DIMENSIONS: Record<PaperSize, PaperDimensions> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  a5: { widthMm: 148, heightMm: 210 },
}

const PAGE_MARGIN_MM = 15
const CARD_GAP_MM = 8
const CUT_MARK_LENGTH_MM = 4
const CUT_MARK_OFFSET_MM = 2
const DEFAULT_DPI = 300

export interface PackedSide {
  /** Final mode + watermark blob from the scanner render pipeline. */
  blob: Blob
  spec: DocSpec
}

export interface PackedSheetResult {
  /** PNG of the full sheet (lossless; jsPDF re-encodes as JPEG for size). */
  blob: Blob
  /** Pixel width of the rendered sheet. */
  width: number
  /** Pixel height of the rendered sheet. */
  height: number
  /** Pixels per millimeter for the rendered sheet (DPI-derived). */
  pxPerMm: number
  /** The paper size this sheet was rendered at. */
  paperSize: PaperSize
}

/**
 * Compose `sides` onto a single sheet of `paperSize` portrait and
 * return it as a PNG blob. Order is preserved: front first, then
 * back (when present).
 *
 * Returns `null` when called with no sides — caller should disable
 * the export CTA in that case.
 */
export async function packSheet(
  sides: readonly PackedSide[],
  paperSize: PaperSize = 'a4',
  dpi: number = DEFAULT_DPI,
): Promise<PackedSheetResult | null> {
  if (sides.length === 0) return null

  const paper = PAPER_DIMENSIONS[paperSize]
  const pxPerMm = dpi / 25.4
  const pageWidth = Math.round(paper.widthMm * pxPerMm)
  const pageHeight = Math.round(paper.heightMm * pxPerMm)
  const margin = Math.round(PAGE_MARGIN_MM * pxPerMm)
  const gap = Math.round(CARD_GAP_MM * pxPerMm)

  const canvas = document.createElement('canvas')
  canvas.width = pageWidth
  canvas.height = pageHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('packA4Portrait: failed to create 2d context')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pageWidth, pageHeight)

  let cursorY = margin

  for (const side of sides) {
    const dims = getOutputPixels(side.spec, dpi)
    const x = Math.round((pageWidth - dims.width) / 2)
    // If a card overflows the page (e.g. someone packs two A4-sized
    // sheets onto one A4), bail out instead of clipping mid-image.
    if (cursorY + dims.height > pageHeight - margin) break

    const bitmap = await createImageBitmap(side.blob)
    try {
      ctx.drawImage(bitmap, x, cursorY, dims.width, dims.height)
    } finally {
      bitmap.close?.()
    }

    drawCutMarks(ctx, x, cursorY, dims.width, dims.height, pxPerMm)
    cursorY += dims.height + gap
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('packA4Portrait: toBlob returned null'))),
      'image/png',
    )
  })

  return {
    blob,
    width: pageWidth,
    height: pageHeight,
    pxPerMm,
    paperSize,
  }
}

/**
 * Back-compat alias for the V1 A4 default. New callers should prefer
 * `packSheet(sides, paperSize)` so they can let the user pick.
 */
export const packA4Portrait = (sides: readonly PackedSide[], dpi?: number) =>
  packSheet(sides, 'a4', dpi)

/**
 * Draw light corner ticks just outside the card boundaries so the
 * user can cut precisely after printing. 4 mm long, 2 mm offset, 0.3
 * mm stroke — visible without being noisy.
 */
function drawCutMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pxPerMm: number,
): void {
  const len = Math.round(CUT_MARK_LENGTH_MM * pxPerMm)
  const off = Math.round(CUT_MARK_OFFSET_MM * pxPerMm)
  ctx.save()
  ctx.strokeStyle = '#999'
  ctx.lineWidth = Math.max(1, Math.round(0.3 * pxPerMm))

  // 4 corners × 2 ticks each (one vertical from the corner running
  // outward, one horizontal). 8 strokes total.
  const corners = [
    { cx: x, cy: y, dx: -1, dy: -1 }, // top-left
    { cx: x + w, cy: y, dx: 1, dy: -1 }, // top-right
    { cx: x, cy: y + h, dx: -1, dy: 1 }, // bottom-left
    { cx: x + w, cy: y + h, dx: 1, dy: 1 }, // bottom-right
  ] as const

  for (const corner of corners) {
    // Vertical tick: from `cy + dy*off` running another `dy*len` outward.
    ctx.beginPath()
    ctx.moveTo(corner.cx, corner.cy + corner.dy * off)
    ctx.lineTo(corner.cx, corner.cy + corner.dy * (off + len))
    ctx.stroke()
    // Horizontal tick: from `cx + dx*off` running another `dx*len` outward.
    ctx.beginPath()
    ctx.moveTo(corner.cx + corner.dx * off, corner.cy)
    ctx.lineTo(corner.cx + corner.dx * (off + len), corner.cy)
    ctx.stroke()
  }
  ctx.restore()
}

export const PACK_SHEET_CONSTANTS = {
  PAGE_MARGIN_MM,
  CARD_GAP_MM,
  DEFAULT_DPI,
} as const

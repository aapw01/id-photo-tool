'use client'

/**
 * Pack one or two rectified document images onto a single paper
 * sheet (A4 / Letter / A5, portrait), ready for PDF embed or PNG
 * export.
 *
 * Layout:
 *
 *   - **Portrait at 300 DPI**. A4 (210 × 297 mm), Letter (215.9 ×
 *     279.4 mm) and A5 (148 × 210 mm).
 *   - **Physical-size print scale**: each card is drawn at its
 *     spec dimensions (`docSpec.widthMm × heightMm`), centered
 *     horizontally and stacked vertically with an 8 mm gap. This
 *     mimics what a photocopier produces when copying an ID card
 *     onto A4 — the document keeps its real-world size; the rest of
 *     the page stays white. (Users who want the document blown up to
 *     fill the page should print "Fit to page" in their printer
 *     driver — we don't bake that into the export bytes.)
 *   - **Watermark over the entire sheet**: after laying out the
 *     cards we draw the diagonal-tile watermark across the full page
 *     (not just the document rects), so empty margins are protected
 *     too and a user who screenshots only the white area can't get
 *     a clean copy.
 *   - **Cut marks at each card's corners** assist physical trimming.
 *   - **White background** — explicitly painted so PDF/JPEG re-
 *     encoders don't surprise us with transparency artifacts.
 */

import type { DocSpec } from './doc-specs'
import { drawWatermark, type WatermarkConfig } from './watermark'

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

export interface PackSheetOptions {
  /** Pixels per inch for the rendered sheet. Defaults to 300. */
  dpi?: number
  /**
   * Watermark to draw across the entire page after cards are laid
   * out. Omit to leave the sheet's empty margins unprotected —
   * usually only desirable in tests.
   */
  watermark?: WatermarkConfig
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
  options: PackSheetOptions = {},
): Promise<PackedSheetResult | null> {
  if (sides.length === 0) return null

  const { dpi = DEFAULT_DPI, watermark } = options
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
  if (!ctx) throw new Error('packSheet: failed to create 2d context')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pageWidth, pageHeight)

  let cursorY = margin
  for (const side of sides) {
    // Each card draws at its physical mm dimensions so the printed
    // result keeps the document's real-world size — same behavior as
    // a photocopier copying an ID onto A4.
    const drawW = Math.round(side.spec.widthMm * pxPerMm)
    const drawH = Math.round(side.spec.heightMm * pxPerMm)
    const x = Math.round((pageWidth - drawW) / 2)
    // Bail before drawing anything that would clip the bottom margin.
    if (cursorY + drawH > pageHeight - margin) break

    const bitmap = await createImageBitmap(side.blob)
    try {
      ctx.drawImage(bitmap, x, cursorY, drawW, drawH)
    } finally {
      bitmap.close?.()
    }

    drawCutMarks(ctx, x, cursorY, drawW, drawH, pxPerMm)
    cursorY += drawH + gap
  }

  // Overlay watermark across the entire page (margins + cards). The
  // per-side watermark from render-modes still keeps single-side PNG
  // downloads protected; this page-wide pass is what makes the empty
  // A4 surface unusable for a clean re-copy.
  if (watermark) {
    drawWatermark(ctx, pageWidth, pageHeight, watermark, 'scan')
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('packSheet: toBlob returned null'))),
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
 * `packSheet(sides, paperSize, options)` so they can let the user
 * pick paper size and attach a watermark.
 */
export const packA4Portrait = (sides: readonly PackedSide[], dpi?: number) =>
  packSheet(sides, 'a4', { dpi })

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

  // 4 corners × 2 ticks each (one vertical, one horizontal). 8
  // strokes total.
  const corners = [
    { cx: x, cy: y, dx: -1, dy: -1 }, // top-left
    { cx: x + w, cy: y, dx: 1, dy: -1 }, // top-right
    { cx: x, cy: y + h, dx: -1, dy: 1 }, // bottom-left
    { cx: x + w, cy: y + h, dx: 1, dy: 1 }, // bottom-right
  ] as const

  for (const corner of corners) {
    ctx.beginPath()
    ctx.moveTo(corner.cx, corner.cy + corner.dy * off)
    ctx.lineTo(corner.cx, corner.cy + corner.dy * (off + len))
    ctx.stroke()
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

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
 *     spec dimensions (`docSpec.widthMm × heightMm`). This mimics
 *     what a photocopier produces when copying an ID card onto A4 —
 *     the document keeps its real-world size; the rest of the page
 *     stays white. (Users who want the document blown up to fill
 *     the page should pick "Fit to page" in their printer driver —
 *     we don't bake that into the export bytes.)
 *   - **Evenly distributed vertically**: when the user packs N
 *     sides we split the page into N equal-height bands and center
 *     each card inside its band. This avoids the previous tight-stack
 *     layout where front + back sat shoulder-to-shoulder near the top
 *     of an otherwise-empty A4. With even distribution two ID cards
 *     on A4 sit roughly at the page's quarter and three-quarter
 *     heights — visually balanced regardless of doc spec / paper size.
 *   - **Page-wide watermark**: drawn after the cards, covers the
 *     entire sheet (margins + cards). `packSheet` is the single
 *     watermark stage on the export — callers MUST pass watermark-
 *     free per-side blobs (e.g. by re-running `renderOutputMode`
 *     without a `watermark` arg). The preview pane uses the
 *     watermarked per-side blob so the user can see their settings;
 *     mixing that blob into `packSheet` would produce overlapping
 *     watermarks again.
 *   - **White background** — explicitly painted so PDF/JPEG re-
 *     encoders don't surprise us with transparency artifacts.
 *
 * No cut marks: an earlier revision drew small corner tick marks
 * outside each card boundary as trimming guides. The user found them
 * noisy on the digital PDF; they're gone now.
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
   * out. Omit to leave the sheet unwatermarked (only useful in tests).
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

  const canvas = document.createElement('canvas')
  canvas.width = pageWidth
  canvas.height = pageHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('packSheet: failed to create 2d context')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pageWidth, pageHeight)

  // Equal-height bands, one per side. Each card centers inside its
  // band so different doc specs / paper sizes get balanced spacing
  // without per-spec margin tuning.
  const bandHeight = pageHeight / sides.length
  for (let i = 0; i < sides.length; i++) {
    const side = sides[i]!
    const drawW = Math.round(side.spec.widthMm * pxPerMm)
    const drawH = Math.round(side.spec.heightMm * pxPerMm)
    const x = Math.round((pageWidth - drawW) / 2)
    const y = Math.round(i * bandHeight + (bandHeight - drawH) / 2)

    const bitmap = await createImageBitmap(side.blob)
    try {
      ctx.drawImage(bitmap, x, y, drawW, drawH)
    } finally {
      bitmap.close?.()
    }
  }

  // Single watermark layer — page-wide, covers cards + margins. The
  // per-side renderer intentionally stopped stamping the document
  // body so users don't see double watermarks (mismatched font sizes
  // between the small per-side stamp and the large page-wide tile
  // looked sloppy in the PDF).
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

export const PACK_SHEET_CONSTANTS = {
  DEFAULT_DPI,
} as const

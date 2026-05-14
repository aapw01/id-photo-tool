'use client'

/**
 * Generate a PDF from a packed A4 PNG via `jspdf`. The output is a
 * single-page A4 portrait document at 210 × 297 mm, with the packed
 * sheet embedded as a JPEG-compressed image (good balance of file
 * size vs print quality at 300 DPI).
 *
 * `jspdf` is *eagerly* imported here — it ships ~340 KB minified,
 * which is small enough that we don't bother with a dynamic import:
 * users only hit this path when they actually export.
 *
 * Returns a `Blob` of `application/pdf` so the caller can either
 * trigger a direct download (via blob URL + `<a download>`) or
 * persist into the (future) history store.
 */

import jsPDF from 'jspdf'

import { PAPER_DIMENSIONS, type PackedSheetResult } from './pack-a4'

export interface ExportPdfOptions {
  /** Sheet from `packSheet`. */
  packed: PackedSheetResult
  /** JPEG quality for the embedded image. Defaults to 0.92. */
  quality?: number
  /** Optional metadata title for the PDF reader. */
  title?: string
}

export async function exportPackedSheetToPdf(options: ExportPdfOptions): Promise<Blob> {
  const { packed, quality = 0.92, title } = options
  const paper = PAPER_DIMENSIONS[packed.paperSize]

  // Decode the packed PNG, then re-encode as JPEG for embedding.
  // jspdf accepts dataUrls; canvas → JPEG dataUrl is the most
  // size-efficient path at 300 DPI.
  const bitmap = await createImageBitmap(packed.blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('exportPackedSheetToPdf: failed to create 2d context')
    ctx.drawImage(bitmap, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)

    const pdf = new jsPDF({
      unit: 'mm',
      format: packed.paperSize,
      orientation: 'portrait',
      compress: true,
    })
    if (title) pdf.setProperties({ title })
    pdf.addImage(dataUrl, 'JPEG', 0, 0, paper.widthMm, paper.heightMm, undefined, 'FAST')
    return pdf.output('blob')
  } finally {
    bitmap.close?.()
  }
}

/** Back-compat alias kept for the S5 callsite name. */
export const exportPackedA4ToPdf = exportPackedSheetToPdf

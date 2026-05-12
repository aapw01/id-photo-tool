/**
 * Vector PDF export for layouts — TECH_DESIGN §5.5.4.
 *
 * The PDF page is sized to the paper's physical mm dimensions. Each
 * cell becomes a single `addImage()` call at mm coordinates, and (when
 * enabled) the cut guides are drawn as vector lines so print shops get
 * sharp marks at any zoom.
 *
 * jsPDF is loaded lazily because it ships ~290 KB of font tables;
 * we don't want it in the Studio main bundle.
 */

import { derivePixels } from '@/lib/spec-units'
import type { Cell, LayoutTemplate, PaperSpec, PhotoSpec } from '@/types/spec'

import { drawPdfCutGuides } from './cut-guides'
import { resolveLayoutCells } from './pack-mixed'

export interface PdfExportOptions {
  paper: PaperSpec
  template: LayoutTemplate
  getSpec: (id: string) => PhotoSpec | null
  /** Per-spec image as a `data:image/png;base64,...` URL or a Blob.
   * Blobs are converted to data URLs internally. */
  getCellImageDataUrl: (spec: PhotoSpec) => Promise<string | null>
  settingsOverride?: Partial<NonNullable<LayoutTemplate['settings']>>
}

export interface PdfExportResult {
  blob: Blob
  placedCount: number
  overflow: Array<{ spec: PhotoSpec; count: number }>
}

/**
 * Build the PDF. Returns a Blob the caller can wire to a download
 * anchor. Errors bubble up so the panel can show a toast.
 */
export async function exportLayoutPdf(opts: PdfExportOptions): Promise<PdfExportResult> {
  const { paper, template, getSpec, getCellImageDataUrl } = opts
  const settings = { ...(template.settings ?? {}), ...(opts.settingsOverride ?? {}) }
  const margin_mm = settings.margin_mm ?? 2
  const gap_mm = settings.gap_mm ?? 2

  // jsPDF's default export shape is a named export; some ESM bundles
  // wrap it in `default`. Handle both.
  const mod = await import('jspdf')
  const Ctor =
    (mod as { jsPDF?: typeof import('jspdf').jsPDF }).jsPDF ??
    (mod as unknown as { default: typeof import('jspdf').jsPDF }).default

  const doc = new Ctor({
    unit: 'mm',
    format: [paper.width_mm, paper.height_mm],
    orientation: paper.width_mm > paper.height_mm ? 'landscape' : 'portrait',
    compress: true,
  })

  // Optional paper background — jsPDF supports a filled rectangle.
  if (settings.backgroundColor && settings.backgroundColor.toLowerCase() !== '#ffffff') {
    const rgb = hexToRgb(settings.backgroundColor)
    if (rgb) {
      doc.setFillColor(rgb.r, rgb.g, rgb.b)
      doc.rect(0, 0, paper.width_mm, paper.height_mm, 'F')
    }
  }

  const items = template.items
    .map((entry) => {
      const spec = getSpec(entry.photoSpecId)
      return spec ? { spec, count: entry.count } : null
    })
    .filter((x): x is { spec: PhotoSpec; count: number } => Boolean(x))

  let cells: Cell[]
  let overflow: PdfExportResult['overflow'] = []
  if (template.arrangement.kind === 'manual') {
    cells = template.arrangement.cells
  } else {
    const result = resolveLayoutCells(paper, items, { margin_mm, gap_mm })
    cells = result.cells
    overflow = result.overflow
  }

  // Resolve each spec's image data URL once; cells may repeat.
  const imageCache = new Map<string, string | null>()
  for (const item of items) {
    if (imageCache.has(item.spec.id)) continue
    imageCache.set(item.spec.id, await getCellImageDataUrl(item.spec))
  }

  const placed: Array<{ cell: Cell; spec: PhotoSpec }> = []
  for (const cell of cells) {
    const spec = getSpec(cell.photoSpecId)
    if (!spec) continue
    const dataUrl = imageCache.get(spec.id) ?? null
    const rotated = cell.rotation === 90 || cell.rotation === 270
    const w = rotated ? spec.height_mm : spec.width_mm
    const h = rotated ? spec.width_mm : spec.height_mm
    if (dataUrl) {
      const r = derivePixels(spec)
      doc.addImage({
        imageData: dataUrl,
        format: dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG',
        x: cell.x_mm,
        y: cell.y_mm,
        width: w,
        height: h,
        compression: 'NONE',
        rotation: cell.rotation,
        // Hint the pixel resolution so jsPDF doesn't re-decode.
        ...({ alias: `${spec.id}_${r.width_px}` } as Record<string, unknown>),
      })
    } else {
      // Empty placeholder rectangle when no image is available.
      doc.setDrawColor(200, 200, 200)
      doc.rect(cell.x_mm, cell.y_mm, w, h, 'S')
    }
    placed.push({ cell, spec })
  }

  if (settings.showSeparator) {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.1)
    for (const { cell, spec } of placed) {
      const rotated = cell.rotation === 90 || cell.rotation === 270
      const w = rotated ? spec.height_mm : spec.width_mm
      const h = rotated ? spec.width_mm : spec.height_mm
      doc.rect(cell.x_mm, cell.y_mm, w, h, 'S')
    }
  }

  if (settings.showCutGuides) {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.15)
    drawPdfCutGuides(doc, placed)
  }

  const blob = doc.output('blob')
  return { blob, placedCount: placed.length, overflow }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex)
  if (!m) return null
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  }
}

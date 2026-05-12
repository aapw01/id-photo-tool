/**
 * Rasterise a LayoutTemplate to a canvas — TECH_DESIGN §5.5.3.
 *
 * Output is an HTMLCanvasElement (so the caller can `toBlob` it or
 * embed it). The reason we don't return ImageBitmap is happy-dom
 * doesn't ship `OffscreenCanvas.transferToImageBitmap`, which makes
 * the function untestable.
 *
 * Pipeline:
 *
 *   1. Allocate a canvas at the paper's pixel size (mm × dpi).
 *   2. Paint the chosen background colour.
 *   3. For each cell:
 *        - Use the cropped spec foreground (the same one ExportPanel
 *          uses) and scale it to the cell box.
 *        - Optionally stamp a separator line.
 *   4. Optionally draw corner tick marks.
 */

import type { Cell, LayoutTemplate, PaperSpec, PhotoSpec } from '@/types/spec'
import { mmToPx, derivePixels } from '@/lib/spec-units'

import { drawCutGuides, drawSeparator } from './cut-guides'
import { resolveLayoutCells } from './pack-mixed'

export interface RenderLayoutOptions {
  paper: PaperSpec
  template: LayoutTemplate
  /** Resolver from photoSpecId → PhotoSpec object. */
  getSpec: (id: string) => PhotoSpec | null
  /** Pre-cropped foreground for a given spec. Returns null when not
   * available — render will leave the cell empty + draw a placeholder. */
  getCellImage: (spec: PhotoSpec) => ImageBitmap | HTMLCanvasElement | null
  /** Override the template settings without mutating the source data. */
  settingsOverride?: Partial<NonNullable<LayoutTemplate['settings']>>
  /** Render at a lower DPI for previews. Defaults to paper.dpi. */
  dpi?: number
}

export interface RenderLayoutResult {
  canvas: HTMLCanvasElement
  /** Cells actually placed (with their resolved PhotoSpec attached). */
  placed: Array<{ cell: Cell; spec: PhotoSpec }>
  /** Items the packer couldn't fit. */
  overflow: Array<{ spec: PhotoSpec; count: number }>
}

const PLACEHOLDER_FILL = '#F3F4F6'
const PLACEHOLDER_STROKE = '#D1D5DB'

export function renderLayout(opts: RenderLayoutOptions): RenderLayoutResult {
  const { paper, template, getSpec, getCellImage } = opts
  const settings = { ...(template.settings ?? {}), ...(opts.settingsOverride ?? {}) }
  const dpi = opts.dpi ?? paper.dpi
  // When the caller overrides the DPI (preview mode), drop the
  // explicit pixel dimensions so derivePixels recomputes them.
  const resolvedPaper = derivePixels(
    opts.dpi ? { ...paper, dpi, width_px: undefined, height_px: undefined } : { ...paper, dpi },
  )

  const canvas = document.createElement('canvas')
  canvas.width = resolvedPaper.width_px
  canvas.height = resolvedPaper.height_px
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { canvas, placed: [], overflow: [] }
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Paper background — defaults to white.
  ctx.fillStyle = settings.backgroundColor ?? '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Resolve every spec referenced in the template. Items with an
  // unknown spec are silently dropped — the caller's data layer
  // already validates this, but we don't trust user-imported JSON.
  const items = template.items
    .map((entry) => {
      const spec = getSpec(entry.photoSpecId)
      return spec ? { spec, count: entry.count } : null
    })
    .filter((x): x is { spec: PhotoSpec; count: number } => Boolean(x))

  const margin_mm = settings.margin_mm ?? 2
  const gap_mm = settings.gap_mm ?? 2

  let placed: Array<{ cell: Cell; spec: PhotoSpec }> = []
  let overflow: RenderLayoutResult['overflow'] = []

  if (template.arrangement.kind === 'manual') {
    placed = template.arrangement.cells
      .map((cell) => {
        const spec = getSpec(cell.photoSpecId)
        return spec ? { cell, spec } : null
      })
      .filter((x): x is { cell: Cell; spec: PhotoSpec } => Boolean(x))
  } else {
    const result = resolveLayoutCells(paper, items, { margin_mm, gap_mm })
    overflow = result.overflow
    placed = result.cells.map((cell) => ({
      cell,
      spec: getSpec(cell.photoSpecId)!,
    }))
  }

  for (const { cell, spec } of placed) {
    const rotated = cell.rotation === 90 || cell.rotation === 270
    const cellW_mm = rotated ? spec.height_mm : spec.width_mm
    const cellH_mm = rotated ? spec.width_mm : spec.height_mm
    const x = mmToPx(cell.x_mm, dpi)
    const y = mmToPx(cell.y_mm, dpi)
    const w = mmToPx(cellW_mm, dpi)
    const h = mmToPx(cellH_mm, dpi)

    const img = getCellImage(spec)
    if (img) {
      drawCellImage(ctx, img, x, y, w, h, cell.rotation ?? 0)
    } else {
      // Placeholder slot — easy for users to see "this is where it
      // will land" before they finish cropping.
      ctx.save()
      ctx.fillStyle = PLACEHOLDER_FILL
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = PLACEHOLDER_STROKE
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      ctx.restore()
    }

    if (settings.showSeparator) {
      drawSeparator(ctx, cell.x_mm, cell.y_mm, cellW_mm, cellH_mm, dpi)
    }
  }

  if (settings.showCutGuides) {
    drawCutGuides(ctx, paper, placed, dpi)
  }

  return { canvas, placed, overflow }
}

function drawCellImage(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap | HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: 0 | 90 | 180 | 270,
): void {
  if (rotation === 0) {
    ctx.drawImage(img as CanvasImageSource, x, y, w, h)
    return
  }
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  // After rotation the swapped dimensions become the source space.
  const dw = rotation % 180 === 0 ? w : h
  const dh = rotation % 180 === 0 ? h : w
  ctx.drawImage(img as CanvasImageSource, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

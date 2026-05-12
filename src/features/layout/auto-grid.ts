/**
 * Auto-grid layout packer — TECH_DESIGN §6.4.
 *
 * Two pure functions, both in millimetre coordinates so they're stable
 * across DPI changes:
 *
 *   - `packAutoGrid(paper, photo, opts)` returns the maximum
 *     {cols, rows, total, rotated} that fit on the paper. We try the
 *     spec in both portrait and 90-degree rotation and pick whichever
 *     packs more.
 *
 *   - `gridCells(paper, photo, count, opts)` emits up to `count` cells
 *     (each {photoSpecId, x_mm, y_mm, rotation}) in row-major order.
 *     Cells overflow past `total` are simply dropped — the caller can
 *     warn the user.
 *
 * Tested independently in `auto-grid.test.ts` with the eight built-in
 * paper × photo combinations from PRD §5.6.2.
 */

import type { Cell, PaperSpec, PhotoSpec } from '@/types/spec'

export interface GridOptions {
  margin_mm: number
  gap_mm: number
}

export interface GridFit {
  cols: number
  rows: number
  total: number
  rotated: boolean
  cellWidth_mm: number
  cellHeight_mm: number
}

/**
 * Determine the best grid arrangement of `photo` on `paper`. Returns
 * a zero-fit when nothing fits.
 */
export function packAutoGrid(paper: PaperSpec, photo: PhotoSpec, opts: GridOptions): GridFit {
  const { margin_mm, gap_mm } = opts
  const usableW = paper.width_mm - 2 * margin_mm
  const usableH = paper.height_mm - 2 * margin_mm
  if (usableW <= 0 || usableH <= 0) {
    return zeroFit(photo.width_mm, photo.height_mm)
  }

  const portrait = tryFit(usableW, usableH, photo.width_mm, photo.height_mm, gap_mm)
  const landscape = tryFit(usableW, usableH, photo.height_mm, photo.width_mm, gap_mm)

  if (portrait.total >= landscape.total) {
    return {
      ...portrait,
      rotated: false,
      cellWidth_mm: photo.width_mm,
      cellHeight_mm: photo.height_mm,
    }
  }
  return {
    ...landscape,
    rotated: true,
    cellWidth_mm: photo.height_mm,
    cellHeight_mm: photo.width_mm,
  }
}

function tryFit(
  usableW: number,
  usableH: number,
  cellW: number,
  cellH: number,
  gap: number,
): { cols: number; rows: number; total: number } {
  // Pretend each cell already includes its right / bottom gap. The
  // last cell doesn't actually need it, so add back one `gap` to the
  // usable dimensions — matches PRD's expectation that 5R holds
  // exactly 8 × 1-inch with 5 mm margin / 2 mm gap.
  const cols = cellW > 0 ? Math.floor((usableW + gap) / (cellW + gap)) : 0
  const rows = cellH > 0 ? Math.floor((usableH + gap) / (cellH + gap)) : 0
  const total = Math.max(0, cols) * Math.max(0, rows)
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), total }
}

function zeroFit(w: number, h: number): GridFit {
  return { cols: 0, rows: 0, total: 0, rotated: false, cellWidth_mm: w, cellHeight_mm: h }
}

/**
 * Materialise the cell positions for an auto-grid layout. Cells are
 * emitted in row-major order. If `count` exceeds `total`, the extra
 * slots are dropped; the caller decides whether to display a warning.
 */
export function gridCells(
  paper: PaperSpec,
  photo: PhotoSpec,
  count: number,
  opts: GridOptions,
): Cell[] {
  const fit = packAutoGrid(paper, photo, opts)
  if (fit.total === 0 || count <= 0) return []

  const slots = Math.min(count, fit.total)
  const out: Cell[] = []
  for (let i = 0; i < slots; i++) {
    const c = i % fit.cols
    const r = Math.floor(i / fit.cols)
    out.push({
      photoSpecId: photo.id,
      x_mm: opts.margin_mm + c * (fit.cellWidth_mm + opts.gap_mm),
      y_mm: opts.margin_mm + r * (fit.cellHeight_mm + opts.gap_mm),
      rotation: fit.rotated ? 90 : 0,
    })
  }
  return out
}

/**
 * Convenience overload: pack as many of `photo` as fit. Useful for the
 * A4 catch-all template that asks for `count = 100` but only `total`
 * physically fit.
 */
export function gridCellsToCapacity(paper: PaperSpec, photo: PhotoSpec, opts: GridOptions): Cell[] {
  const fit = packAutoGrid(paper, photo, opts)
  return gridCells(paper, photo, fit.total, opts)
}

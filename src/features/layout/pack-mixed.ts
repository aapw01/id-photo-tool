/**
 * Mixed-spec layout packer — TECH_DESIGN §5.5.2.
 *
 * Strategy: place items largest-first row-by-row. Each item type
 * claims a horizontal strip whose height matches the chosen cell
 * orientation; smaller items follow in the remaining space.
 *
 * This is intentionally a heuristic, not an NP-hard optimal packer —
 * the printable list is short (≤ 4 distinct items) and predictable.
 * Tests cover the four canonical mixes in PRD §5.6.2 plus the
 * overflow + single-item degenerate cases.
 */

import type { Cell, PaperSpec, PhotoSpec } from '@/types/spec'

import { packAutoGrid, gridCells, type GridOptions } from './auto-grid'

export interface MixedItem {
  spec: PhotoSpec
  count: number
}

export interface MixedResult {
  cells: Cell[]
  /** Items we couldn't fit, ordered same as input. `count` is the
   * residual quantity that overflowed. */
  overflow: Array<{ spec: PhotoSpec; count: number }>
  /** Final vertical cursor in mm so the layout renderer can fill the
   * remaining space with cut-guides or backgrounds. */
  bottom_mm: number
}

/**
 * Pack a heterogeneous list of items onto `paper`. Items are sorted by
 * area descending so the bigger ones get the most-favorable strips.
 *
 * The packer reserves a fresh strip for each spec — within that strip
 * it uses the auto-grid packer to maximise count. If a spec doesn't
 * fit in the remaining vertical room it's added to `overflow`.
 */
export function packMixed(paper: PaperSpec, items: MixedItem[], opts: GridOptions): MixedResult {
  const cells: Cell[] = []
  const overflow: MixedResult['overflow'] = []

  // Sort by area descending; PRD says the bigger photos take the
  // dominant strip first so the smaller ones fill the leftover row(s).
  const sorted = [...items].sort(
    (a, b) => b.spec.width_mm * b.spec.height_mm - a.spec.width_mm * a.spec.height_mm,
  )

  let cursorY = opts.margin_mm
  const usableW = paper.width_mm - 2 * opts.margin_mm
  const bottomLimit = paper.height_mm - opts.margin_mm

  for (const item of sorted) {
    if (item.count <= 0) continue

    // Build a virtual paper covering just the remaining strip so the
    // auto-grid packer thinks it's working with a smaller surface.
    const remainingH = bottomLimit - cursorY
    if (remainingH <= 0) {
      overflow.push({ spec: item.spec, count: item.count })
      continue
    }
    const virtualPaper: PaperSpec = {
      ...paper,
      width_mm: usableW + 2 * opts.margin_mm,
      // Account for the margin the real paper has at the top.
      height_mm: remainingH + 2 * opts.margin_mm,
    }
    const fit = packAutoGrid(virtualPaper, item.spec, opts)
    if (fit.total === 0) {
      overflow.push({ spec: item.spec, count: item.count })
      continue
    }

    const take = Math.min(item.count, fit.total)
    const stripCells = gridCells(virtualPaper, item.spec, take, opts)
    // The virtual paper's coordinate system starts at (margin, margin).
    // Map back to absolute paper coordinates by replacing the y offset.
    for (const c of stripCells) {
      cells.push({
        ...c,
        // Virtual paper origin was at the absolute paper's left + cursorY.
        x_mm: c.x_mm,
        y_mm: c.y_mm + (cursorY - opts.margin_mm),
      })
    }

    // Advance the cursor by the number of rows actually used.
    const rowsUsed = Math.ceil(take / fit.cols)
    cursorY = cursorY + rowsUsed * (fit.cellHeight_mm + opts.gap_mm) - opts.gap_mm + opts.gap_mm

    const remaining = item.count - take
    if (remaining > 0) {
      overflow.push({ spec: item.spec, count: remaining })
    }
  }

  return { cells, overflow, bottom_mm: cursorY }
}

/**
 * Resolve a LayoutTemplate's items[] into a flat list of cells.
 * Picks the auto-grid path for single-item templates and the mixed
 * packer otherwise. The caller still has to map photoSpecIds to
 * physical pixel dimensions via `derivePixels` before rendering.
 */
export function resolveLayoutCells(
  paper: PaperSpec,
  items: MixedItem[],
  opts: GridOptions,
): MixedResult {
  if (items.length === 1) {
    const only = items[0]!
    const cells = gridCells(paper, only.spec, only.count, opts)
    const overflow: MixedResult['overflow'] = []
    if (cells.length < only.count) {
      overflow.push({ spec: only.spec, count: only.count - cells.length })
    }
    const last = cells[cells.length - 1]
    const bottom = last ? last.y_mm + only.spec.height_mm : opts.margin_mm
    return { cells, overflow, bottom_mm: bottom }
  }
  return packMixed(paper, items, opts)
}

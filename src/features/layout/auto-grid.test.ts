/**
 * Auto-grid packer — covers the eight canonical paper × photo
 * combinations from PRD §5.6.2, plus rotation, overflow, and
 * zero-fit edge cases.
 */

import { describe, expect, it } from 'vitest'

import { gridCells, gridCellsToCapacity, packAutoGrid } from './auto-grid'
import { getPaperSpec } from '@/data/paper-specs'
import { getPhotoSpec } from '@/data/photo-specs'
import type { PaperSpec, PhotoSpec } from '@/types/spec'

const DEFAULT = { margin_mm: 5, gap_mm: 2 }

function pair(paperId: string, photoId: string): [PaperSpec, PhotoSpec] {
  const paper = getPaperSpec(paperId)
  const photo = getPhotoSpec(photoId)
  if (!paper || !photo) throw new Error(`fixture missing: ${paperId} / ${photoId}`)
  return [paper, photo]
}

describe('packAutoGrid — canonical PRD §5.6.2 combos', () => {
  it('5R + 1-inch fits ≥ 8 (template `8x1inch-on-5R`)', () => {
    const [paper, photo] = pair('5R', 'cn-1inch')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.total).toBeGreaterThanOrEqual(8)
  })

  it('6R + 1-inch fits ≥ 16 (template `16x1inch-on-6R`)', () => {
    const [paper, photo] = pair('6R', 'cn-1inch')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.total).toBeGreaterThanOrEqual(16)
  })

  it('6R + 2-inch fits ≥ 8 (template `8x2inch-on-6R`)', () => {
    const [paper, photo] = pair('6R', 'cn-2inch')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.total).toBeGreaterThanOrEqual(8)
  })

  it('5R + Chinese ID card fits ≥ 9', () => {
    const [paper, photo] = pair('5R', 'cn-id-card')
    const fit = packAutoGrid(paper, photo, { margin_mm: 5, gap_mm: 2 })
    expect(fit.total).toBeGreaterThanOrEqual(9)
  })

  it('5R + Chinese passport fits ≥ 4', () => {
    const [paper, photo] = pair('5R', 'cn-passport')
    const fit = packAutoGrid(paper, photo, { margin_mm: 5, gap_mm: 3 })
    expect(fit.total).toBeGreaterThanOrEqual(4)
  })

  it('5R + Large 2-inch fits ≥ 4', () => {
    const [paper, photo] = pair('5R', 'cn-2inch-large')
    const fit = packAutoGrid(paper, photo, { margin_mm: 5, gap_mm: 3 })
    expect(fit.total).toBeGreaterThanOrEqual(4)
  })

  it('6R + Large wallet fits ≥ 2', () => {
    const [paper, photo] = pair('6R', 'cn-wallet-large')
    const fit = packAutoGrid(paper, photo, { margin_mm: 5, gap_mm: 3 })
    expect(fit.total).toBeGreaterThanOrEqual(2)
  })

  it('A4 + 1-inch fits ≥ 32 (catch-all template)', () => {
    const [paper, photo] = pair('A4', 'cn-1inch')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.total).toBeGreaterThanOrEqual(32)
  })
})

describe('packAutoGrid — rotation', () => {
  it('picks landscape orientation when it packs more photos', () => {
    // 6R is landscape (203×152). A portrait 1-inch (25×35) fits 7×3 = 21,
    // rotated 5×5 = 25. So `rotated: true` should be the winner.
    const [paper, photo] = pair('6R', 'cn-1inch')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.rotated).toBe(true)
  })

  it('keeps portrait orientation when it ties or wins', () => {
    // Square US visa (51×51) → no orientation gain. Should not rotate.
    const [paper, photo] = pair('5R', 'us-visa')
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(fit.rotated).toBe(false)
  })
})

describe('gridCells — coordinates', () => {
  it('emits cells in row-major order', () => {
    const [paper, photo] = pair('5R', 'cn-1inch')
    const cells = gridCells(paper, photo, 4, DEFAULT)
    expect(cells.length).toBe(4)
    // First cell sits at margin × margin.
    expect(cells[0]!.x_mm).toBeCloseTo(5)
    expect(cells[0]!.y_mm).toBeCloseTo(5)
    // Last cell is right of or below the first.
    expect(cells[3]!.x_mm + cells[3]!.y_mm).toBeGreaterThan(cells[0]!.x_mm + cells[0]!.y_mm)
  })

  it('caps emitted cells at the grid total', () => {
    const [paper, photo] = pair('5R', 'cn-passport')
    const fit = packAutoGrid(paper, photo, { margin_mm: 5, gap_mm: 3 })
    const cells = gridCells(paper, photo, fit.total + 50, { margin_mm: 5, gap_mm: 3 })
    expect(cells.length).toBe(fit.total)
  })

  it('returns [] when count is 0 or paper is tiny', () => {
    const [paper, photo] = pair('5R', 'cn-1inch')
    expect(gridCells(paper, photo, 0, DEFAULT)).toEqual([])
    const tinyPaper = { ...paper, width_mm: 5, height_mm: 5 }
    expect(gridCells(tinyPaper, photo, 10, DEFAULT)).toEqual([])
  })

  it('every cell carries the spec id and rotation flag', () => {
    const [paper, photo] = pair('6R', 'cn-1inch')
    const cells = gridCells(paper, photo, 5, DEFAULT)
    for (const c of cells) {
      expect(c.photoSpecId).toBe('cn-1inch')
      expect([0, 90]).toContain(c.rotation)
    }
  })
})

describe('gridCellsToCapacity', () => {
  it('fills the paper exactly to the calculated grid total', () => {
    const [paper, photo] = pair('A4', 'cn-1inch')
    const cells = gridCellsToCapacity(paper, photo, DEFAULT)
    const fit = packAutoGrid(paper, photo, DEFAULT)
    expect(cells.length).toBe(fit.total)
  })
})

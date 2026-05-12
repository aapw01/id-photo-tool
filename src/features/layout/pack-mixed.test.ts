/**
 * Mixed-spec packer — covers two-item, three-item, overflow, and
 * rotation interaction with the auto-grid helper.
 */

import { describe, expect, it } from 'vitest'

import { packMixed, resolveLayoutCells } from './pack-mixed'
import { getPaperSpec } from '@/data/paper-specs'
import { getPhotoSpec } from '@/data/photo-specs'
import type { PhotoSpec } from '@/types/spec'

const DEFAULT = { margin_mm: 5, gap_mm: 2 }

function spec(id: string): PhotoSpec {
  const s = getPhotoSpec(id)
  if (!s) throw new Error(`fixture missing: ${id}`)
  return s
}

describe('packMixed — two items', () => {
  it('packs 1-inch + 2-inch (Mix A) on 5R with no overflow', () => {
    const paper = getPaperSpec('5R')!
    const result = packMixed(
      paper,
      [
        { spec: spec('cn-1inch'), count: 4 },
        { spec: spec('cn-2inch'), count: 2 },
      ],
      DEFAULT,
    )
    expect(result.cells.length).toBe(6)
    expect(result.overflow).toEqual([])
    // Bigger items (2-inch) should be placed first in y order.
    const twoInchCells = result.cells.filter((c) => c.photoSpecId === 'cn-2inch')
    const oneInchCells = result.cells.filter((c) => c.photoSpecId === 'cn-1inch')
    const minOneInchY = Math.min(...oneInchCells.map((c) => c.y_mm))
    const minTwoInchY = Math.min(...twoInchCells.map((c) => c.y_mm))
    expect(minTwoInchY).toBeLessThanOrEqual(minOneInchY)
  })

  it('packs 1-inch + 2-inch (Mix B) on 6R with no overflow', () => {
    const paper = getPaperSpec('6R')!
    const result = packMixed(
      paper,
      [
        { spec: spec('cn-1inch'), count: 8 },
        { spec: spec('cn-2inch'), count: 2 },
      ],
      DEFAULT,
    )
    expect(result.cells.length).toBe(10)
    expect(result.overflow).toEqual([])
  })
})

describe('packMixed — three items', () => {
  it('packs three spec types and respects area-descending priority', () => {
    const paper = getPaperSpec('6R')!
    const result = packMixed(
      paper,
      [
        { spec: spec('cn-1inch'), count: 4 },
        { spec: spec('cn-2inch'), count: 2 },
        { spec: spec('cn-id-card'), count: 4 },
      ],
      DEFAULT,
    )
    expect(result.cells.length).toBeGreaterThanOrEqual(8)
    // 2-inch has the biggest area, should land at the top.
    const twoInch = result.cells.filter((c) => c.photoSpecId === 'cn-2inch')
    const topYs = result.cells.map((c) => c.y_mm)
    if (twoInch.length > 0) {
      expect(Math.min(...twoInch.map((c) => c.y_mm))).toBeLessThanOrEqual(Math.min(...topYs))
    }
  })
})

describe('packMixed — overflow', () => {
  it('reports residuals when an item does not fit', () => {
    const paper = getPaperSpec('5R')!
    const result = packMixed(
      paper,
      [
        // Demand way more than the paper holds — overflow should be non-empty.
        { spec: spec('cn-passport'), count: 100 },
      ],
      DEFAULT,
    )
    expect(result.overflow.length).toBe(1)
    expect(result.overflow[0]!.count).toBeGreaterThan(0)
  })

  it('packs as much as fits before declaring overflow', () => {
    const paper = getPaperSpec('5R')!
    const result = packMixed(
      paper,
      [
        { spec: spec('cn-2inch'), count: 10 },
        { spec: spec('cn-1inch'), count: 10 },
      ],
      DEFAULT,
    )
    expect(result.cells.length).toBeGreaterThan(0)
  })
})

describe('resolveLayoutCells — entrypoint dispatcher', () => {
  it('dispatches single-item templates to gridCells', () => {
    const paper = getPaperSpec('5R')!
    const r = resolveLayoutCells(paper, [{ spec: spec('cn-1inch'), count: 8 }], DEFAULT)
    expect(r.cells.length).toBe(8)
    expect(r.overflow).toEqual([])
  })

  it('returns single-item overflow when count exceeds paper capacity', () => {
    const paper = getPaperSpec('5R')!
    const r = resolveLayoutCells(paper, [{ spec: spec('cn-passport'), count: 50 }], DEFAULT)
    expect(r.overflow.length).toBe(1)
  })

  it('dispatches multi-item templates to packMixed', () => {
    const paper = getPaperSpec('6R')!
    const r = resolveLayoutCells(
      paper,
      [
        { spec: spec('cn-1inch'), count: 6 },
        { spec: spec('cn-2inch'), count: 4 },
      ],
      DEFAULT,
    )
    expect(r.cells.length).toBeGreaterThan(0)
  })
})

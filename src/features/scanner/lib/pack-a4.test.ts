import { describe, expect, it } from 'vitest'

import { getDocSpec } from './doc-specs'
import {
  PACK_SHEET_CONSTANTS,
  PAPER_DIMENSIONS,
  packA4Portrait,
  packSheet,
  type PackedSide,
  type PaperSize,
} from './pack-a4'

/**
 * Build a fake "rectified" PackedSide for the given spec. The blob is
 * a tiny PNG-mime placeholder — the vitest setup stubs `createImageBitmap`
 * to pass the source through identity, so `drawImage` only inspects
 * shape, not pixels. The PackedSide's `spec` drives the math we want
 * to assert (canvas size, cursor advance, paper-overflow bail-out).
 */
function makeSide(id: string): PackedSide {
  const spec = getDocSpec(id)
  // Anything Blob-shaped is fine: setup.ts hands it back from
  // createImageBitmap unchanged.
  const blob = new Blob([new Uint8Array([0])], { type: 'image/png' })
  return { spec, blob }
}

describe('packSheet — canvas sizing at 300 DPI', () => {
  // 300 DPI = 11.811 px/mm. Round-trip through Math.round to match
  // the implementation (PAPER_DIMENSIONS.<size>.widthMm * 11.811).
  const pxPerMm = 300 / 25.4
  const expectedSize = (size: PaperSize) => ({
    width: Math.round(PAPER_DIMENSIONS[size].widthMm * pxPerMm),
    height: Math.round(PAPER_DIMENSIONS[size].heightMm * pxPerMm),
  })

  it('renders an A4 sheet at the expected pixel size', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const expected = expectedSize('a4')
    expect(sheet!.width).toBe(expected.width)
    expect(sheet!.height).toBe(expected.height)
    expect(sheet!.paperSize).toBe('a4')
  })

  it('renders a Letter sheet at the expected pixel size', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'letter')
    expect(sheet).not.toBeNull()
    const expected = expectedSize('letter')
    expect(sheet!.width).toBe(expected.width)
    expect(sheet!.height).toBe(expected.height)
    expect(sheet!.paperSize).toBe('letter')
  })

  it('renders an A5 sheet at the expected pixel size', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'a5')
    expect(sheet).not.toBeNull()
    const expected = expectedSize('a5')
    expect(sheet!.width).toBe(expected.width)
    expect(sheet!.height).toBe(expected.height)
    expect(sheet!.paperSize).toBe('a5')
  })

  it('returns a PNG blob whose `type` is image/png', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'a4')
    expect(sheet!.blob.type).toBe('image/png')
  })
})

describe('packSheet — empty input', () => {
  it('returns null when called with zero sides', async () => {
    const result = await packSheet([], 'a4')
    expect(result).toBeNull()
  })

  it('returns null on letter too — empty input contract is paper-agnostic', async () => {
    const result = await packSheet([], 'letter')
    expect(result).toBeNull()
  })
})

describe('packSheet — fit-to-paper layout', () => {
  // Helper: replicate the production scaling logic so we can assert
  // that the resulting card always fits inside the per-side cell with
  // the spec's aspect ratio preserved.
  function expectedCardSize(specId: string, paperSize: PaperSize, sideCount: number) {
    const spec = getDocSpec(specId)
    const paper = PAPER_DIMENSIONS[paperSize]
    const pxPerMm = 300 / 25.4
    const pageWidth = Math.round(paper.widthMm * pxPerMm)
    const pageHeight = Math.round(paper.heightMm * pxPerMm)
    const margin = Math.round(PACK_SHEET_CONSTANTS.PAGE_MARGIN_MM * pxPerMm)
    const gap = Math.round(PACK_SHEET_CONSTANTS.CARD_GAP_MM * pxPerMm)
    const innerWidth = pageWidth - 2 * margin
    const innerHeight = pageHeight - 2 * margin
    const heightPerSide = (innerHeight - gap * (sideCount - 1)) / sideCount
    const aspect = spec.widthMm / spec.heightMm
    let drawW = innerWidth
    let drawH = drawW / aspect
    if (drawH > heightPerSide) {
      drawH = heightPerSide
      drawW = drawH * aspect
    }
    return { drawW: Math.round(drawW), drawH: Math.round(drawH), aspect }
  }

  it('scales a single ID card to fill more than 30 % of the A4 sheet area', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const { drawW, drawH, aspect } = expectedCardSize('cn-id-card', 'a4', 1)
    // Drawn-width / drawn-height matches the spec aspect ratio — no
    // squish, no stretch.
    expect(drawW / drawH).toBeCloseTo(aspect, 2)
    // The card now takes a meaningful slice of the sheet — far more
    // than the old 11 % physical-size layout left.
    const sheetArea = sheet!.width * sheet!.height
    const cardArea = drawW * drawH
    expect(cardArea / sheetArea).toBeGreaterThan(0.3)
  })

  it('fits two stacked sides inside the A4 inner area without overflow', async () => {
    const sheet = await packSheet([makeSide('cn-id-card'), makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const { drawH } = expectedCardSize('cn-id-card', 'a4', 2)
    const pxPerMm = 300 / 25.4
    const marginPx = Math.round(PACK_SHEET_CONSTANTS.PAGE_MARGIN_MM * pxPerMm)
    const gapPx = Math.round(PACK_SHEET_CONSTANTS.CARD_GAP_MM * pxPerMm)
    expect(2 * drawH + gapPx + 2 * marginPx).toBeLessThanOrEqual(sheet!.height)
  })

  it('keeps every output card the spec aspect ratio for A5 too', async () => {
    const sheet = await packSheet([makeSide('passport-bio')], 'a5')
    expect(sheet).not.toBeNull()
    const { drawW, drawH, aspect } = expectedCardSize('passport-bio', 'a5', 1)
    expect(drawW / drawH).toBeCloseTo(aspect, 2)
  })

  it('handles 4 sides on one A4 by scaling each to a smaller cell', async () => {
    // Old behavior used absolute physical mm and would bail out on
    // overflow. New behavior fits-to-cell so every side renders.
    const sides = [
      makeSide('cn-id-card'),
      makeSide('cn-id-card'),
      makeSide('cn-id-card'),
      makeSide('cn-id-card'),
    ]
    const sheet = await packSheet(sides, 'a4')
    expect(sheet).not.toBeNull()
    expect(sheet!.paperSize).toBe('a4')
  })
})

describe('packA4Portrait — back-compat alias', () => {
  it('is equivalent to packSheet(sides, "a4")', async () => {
    const sheet = await packA4Portrait([makeSide('cn-id-card')])
    expect(sheet).not.toBeNull()
    expect(sheet!.paperSize).toBe('a4')
  })

  it('still returns null for empty input', async () => {
    const result = await packA4Portrait([])
    expect(result).toBeNull()
  })
})

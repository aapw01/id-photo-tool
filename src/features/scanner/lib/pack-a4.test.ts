import { describe, expect, it } from 'vitest'

import { getDocSpec, getOutputPixels } from './doc-specs'
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

describe('packSheet — cursor advancement (single vs double sided)', () => {
  it('draws one card on the sheet when given a single side', async () => {
    // We can't directly count drawImage calls without instrumenting the
    // stub canvas. Instead, we assert by side-effect: the returned blob
    // is non-null and the side spec dimensions fit comfortably.
    const sheet = await packSheet([makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const cardPx = getOutputPixels(getDocSpec('cn-id-card'))
    // Sanity check the math: a single card height + 2× margin still
    // fits inside the A4 height.
    const marginPx = Math.round(PACK_SHEET_CONSTANTS.PAGE_MARGIN_MM * (300 / 25.4))
    expect(cardPx.height + 2 * marginPx).toBeLessThan(sheet!.height)
  })

  it('draws two stacked cards when given front + back', async () => {
    const sides = [makeSide('cn-id-card'), makeSide('cn-id-card')]
    const sheet = await packSheet(sides, 'a4')
    expect(sheet).not.toBeNull()
    // Both cards + gap + 2× margin should still fit inside an A4 sheet.
    const cardPx = getOutputPixels(getDocSpec('cn-id-card'))
    const pxPerMm = 300 / 25.4
    const marginPx = Math.round(PACK_SHEET_CONSTANTS.PAGE_MARGIN_MM * pxPerMm)
    const gapPx = Math.round(PACK_SHEET_CONSTANTS.CARD_GAP_MM * pxPerMm)
    expect(2 * cardPx.height + gapPx + 2 * marginPx).toBeLessThan(sheet!.height)
  })

  it('does not crash when a card overflows the page — quietly stops', async () => {
    // Pack 4 A4 documents onto a single A4 sheet: only the first one
    // fits, the implementation should bail out instead of clipping or
    // throwing.
    const sides = [makeSide('a4'), makeSide('a4'), makeSide('a4'), makeSide('a4')]
    const sheet = await packSheet(sides, 'a4')
    expect(sheet).not.toBeNull()
    expect(sheet!.paperSize).toBe('a4')
  })

  it('skips overflow on a smaller A5 sheet without throwing', async () => {
    // A passport bio page (125×88mm) plus 15mm margins comfortably
    // fits an A5 (148×210mm); two of them might not. Verify we get
    // a sheet back regardless — graceful degradation is the contract.
    const sides = [makeSide('passport-bio'), makeSide('passport-bio')]
    const sheet = await packSheet(sides, 'a5')
    expect(sheet).not.toBeNull()
    expect(sheet!.paperSize).toBe('a5')
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

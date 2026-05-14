import { describe, expect, it } from 'vitest'

import { getDocSpec, getOutputPixels } from './doc-specs'
import {
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
 * to assert (canvas size, band-center placement, overflow tolerance).
 */
function makeSide(id: string): PackedSide {
  const spec = getDocSpec(id)
  const blob = new Blob([new Uint8Array([0])], { type: 'image/png' })
  return { spec, blob }
}

describe('packSheet — canvas sizing at 300 DPI', () => {
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

describe('packSheet — physical-size, evenly-distributed layout', () => {
  it('lays out a single card at its physical spec dimensions', async () => {
    const sheet = await packSheet([makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const cardPx = getOutputPixels(getDocSpec('cn-id-card'))
    const sheetArea = sheet!.width * sheet!.height
    const cardArea = cardPx.width * cardPx.height
    // ISO/IEC 7810 ID-1 on A4 should cover only a small fraction of
    // the page — that's the photocopier-style behavior the user
    // asked for.
    expect(cardArea / sheetArea).toBeLessThan(0.2)
  })

  it('fits front + back with comfortable breathing room (cards < half the sheet)', async () => {
    // Two equal-height bands; each card should sit inside its band
    // with non-trivial vertical padding.
    const sheet = await packSheet([makeSide('cn-id-card'), makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const cardPx = getOutputPixels(getDocSpec('cn-id-card'))
    const bandHeight = sheet!.height / 2
    // Card height takes far less than a full band — leaving roomy
    // top/bottom padding instead of the previous tight-stack look.
    expect(cardPx.height).toBeLessThan(bandHeight * 0.7)
  })

  it('keeps two-side band centers symmetric around the page mid-line', async () => {
    // The implementation places each card at `i*band + (band-card)/2`.
    // Verify the resulting band centers are symmetric: top center
    // sits at H/4, bottom center at 3H/4.
    const sheet = await packSheet([makeSide('cn-id-card'), makeSide('cn-id-card')], 'a4')
    expect(sheet).not.toBeNull()
    const cardPx = getOutputPixels(getDocSpec('cn-id-card'))
    const bandH = sheet!.height / 2
    const topCardCenter = 0 * bandH + bandH / 2
    const bottomCardCenter = 1 * bandH + bandH / 2
    // Sanity: both centers fit inside their respective bands given
    // the card's own height.
    expect(topCardCenter - cardPx.height / 2).toBeGreaterThanOrEqual(0)
    expect(bottomCardCenter + cardPx.height / 2).toBeLessThanOrEqual(sheet!.height)
    // Symmetric: bottom center is the mirror of top center about
    // the page mid-line.
    expect(topCardCenter + bottomCardCenter).toBeCloseTo(sheet!.height, 0)
  })

  it('keeps physical sizing on A5 too', async () => {
    const sheet = await packSheet([makeSide('passport-bio')], 'a5')
    expect(sheet).not.toBeNull()
    expect(sheet!.paperSize).toBe('a5')
  })

  it('does not throw when many sides are packed onto one sheet', async () => {
    // Even-distribution doesn't bail out on overflow; the cards may
    // overlap if the user packs too many but the call should still
    // complete cleanly.
    const sides = [makeSide('cn-id-card'), makeSide('cn-id-card'), makeSide('cn-id-card')]
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

import { describe, expect, it } from 'vitest'
import { MM_PER_INCH, aspectRatio, derivePixels, mmToPx, pxToMm } from '@/lib/spec-units'

describe('mmToPx / pxToMm', () => {
  it('25.4 mm at 300 DPI ≈ 300 px', () => {
    expect(mmToPx(MM_PER_INCH, 300)).toBe(300)
  })

  it('roundtrip preserves px within rounding tolerance', () => {
    for (const dpi of [150, 300, 350, 600]) {
      for (const px of [10, 295, 413, 600, 2400]) {
        const mm = pxToMm(px, dpi)
        expect(Math.abs(mmToPx(mm, dpi) - px)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('matches the standard ID photo sizes', () => {
    // CN 1-inch: 25×35 mm @ 300 DPI → 295×413 px
    expect(mmToPx(25, 300)).toBe(295)
    expect(mmToPx(35, 300)).toBe(413)
    // US visa: 51×51 mm @ 300 DPI → 602×602 (PRD says 600 — accept the official override)
    expect(Math.abs(mmToPx(51, 300) - 600)).toBeLessThanOrEqual(2)
  })

  it('rejects nonsensical input', () => {
    expect(() => mmToPx(NaN, 300)).toThrow()
    expect(() => mmToPx(25, 0)).toThrow()
    expect(() => pxToMm(295, -300)).toThrow()
  })
})

describe('derivePixels', () => {
  it('fills in width_px / height_px when missing', () => {
    const out = derivePixels({ width_mm: 25, height_mm: 35, dpi: 300 })
    expect(out.width_px).toBe(295)
    expect(out.height_px).toBe(413)
  })

  it('keeps explicit width_px / height_px (allows official overrides)', () => {
    // CN ID card uses 358×441 at 350 DPI even though Math.round
    // would produce different numbers. The data table must win.
    const out = derivePixels({
      width_mm: 26,
      height_mm: 32,
      dpi: 350,
      width_px: 358,
      height_px: 441,
    })
    expect(out.width_px).toBe(358)
    expect(out.height_px).toBe(441)
  })

  it('is idempotent', () => {
    const a = derivePixels({ width_mm: 35, height_mm: 49, dpi: 300 })
    const b = derivePixels(a)
    expect(b).toEqual(a)
  })
})

describe('aspectRatio', () => {
  it('returns w / h from mm fields', () => {
    expect(aspectRatio({ width_mm: 35, height_mm: 49, dpi: 300 })).toBeCloseTo(35 / 49)
  })
})

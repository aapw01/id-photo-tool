import { describe, expect, it } from 'vitest'

import {
  coverCrop,
  fitSelection,
  positiveInt,
  dimensionToPixels,
  pixelsToDimension,
  type SizeUnit,
} from './quick-tools-utils'

describe('coverCrop', () => {
  it('crops the sides for a taller target', () => {
    expect(coverCrop(1600, 900, 600, 750)).toEqual({
      sx: 440,
      sy: 0,
      sw: 720,
      sh: 900,
    })
  })

  it('crops the top and bottom for a wider target', () => {
    expect(coverCrop(900, 1600, 750, 600)).toEqual({
      sx: 0,
      sy: 440,
      sw: 900,
      sh: 720,
    })
  })
})

describe('positiveInt', () => {
  it('falls back for invalid values and caps large values', () => {
    expect(positiveInt('', 600)).toBe(600)
    expect(positiveInt('-1', 600)).toBe(600)
    expect(positiveInt('20000', 600)).toBe(10000)
    expect(positiveInt('750', 600)).toBe(750)
  })
})

describe('size unit conversion', () => {
  it('converts equivalent physical dimensions at 300 DPI', () => {
    expect(dimensionToPixels('25.4', 'mm', 300)).toBe(300)
    expect(dimensionToPixels('2.54', 'cm', 300)).toBe(300)
    expect(dimensionToPixels('1', 'in', 300)).toBe(300)
    expect(dimensionToPixels('35', 'mm', 300)).toBe(413)
    expect(dimensionToPixels('45', 'mm', 300)).toBe(531)
    expect(dimensionToPixels('3.5', 'cm', 600)).toBe(827)
    expect(dimensionToPixels('600', 'px', 72)).toBe(600)
  })

  it('preserves pixel dimensions when switching units', () => {
    for (const unit of ['px', 'mm', 'cm', 'in'] as SizeUnit[]) {
      for (const px of [1, 295, 413, 567, 10000]) {
        expect(dimensionToPixels(pixelsToDimension(px, unit, 300), unit, 300)).toBe(px)
      }
    }
  })

  it('rejects empty, invalid, zero and oversized dimensions', () => {
    for (const value of ['', '-1', '0', 'Infinity', 'abc', '10001']) {
      expect(dimensionToPixels(value, 'px', 300)).toBeNull()
    }
    expect(dimensionToPixels('1000', 'mm', 300)).toBeNull()
    expect(dimensionToPixels('0.000001', 'mm', 300)).toBeNull()
    for (const dpi of [0, -1, NaN, Infinity, 1201]) {
      expect(dimensionToPixels('35', 'mm', dpi)).toBeNull()
    }
  })
})

describe('crop selection', () => {
  it('starts with the largest matching frame inside the image', () => {
    expect(fitSelection(1200, 800, 600, 600, null)).toEqual({ x: 200, y: 0, w: 800, h: 800 })
  })

  it('keeps a manually positioned frame for an unchanged aspect ratio', () => {
    const frame = { x: 30, y: 60, w: 300, h: 300 }
    expect(fitSelection(1200, 800, 200, 200, frame)).toBe(frame)
  })

  it('fits a new ratio around the selection centre without exceeding the image', () => {
    const next = fitSelection(1200, 800, 200, 400, { x: 0, y: 0, w: 400, h: 400 })
    expect(next).toEqual({ x: 100, y: 0, w: 200, h: 400 })
    const bounded = fitSelection(1200, 800, 400, 200, { x: 1100, y: 700, w: 400, h: 400 })
    expect(bounded.x + bounded.w).toBeLessThanOrEqual(1200)
    expect(bounded.y + bounded.h).toBeLessThanOrEqual(800)
    expect(bounded.w / bounded.h).toBe(2)
  })
})

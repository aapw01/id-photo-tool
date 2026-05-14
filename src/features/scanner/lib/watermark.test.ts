import { describe, expect, it } from 'vitest'

import {
  clampWatermarkOpacity,
  DEFAULT_WATERMARK_OPACITY,
  getDefaultWatermarkText,
  MAX_WATERMARK_OPACITY,
  MIN_WATERMARK_OPACITY,
} from './watermark'

describe('clampWatermarkOpacity', () => {
  it('clamps values below the minimum to MIN_WATERMARK_OPACITY', () => {
    expect(clampWatermarkOpacity(0)).toBe(MIN_WATERMARK_OPACITY)
    expect(clampWatermarkOpacity(0.1)).toBe(MIN_WATERMARK_OPACITY)
    expect(clampWatermarkOpacity(-0.5)).toBe(MIN_WATERMARK_OPACITY)
  })

  it('clamps values above the maximum to MAX_WATERMARK_OPACITY', () => {
    expect(clampWatermarkOpacity(1)).toBe(MAX_WATERMARK_OPACITY)
    expect(clampWatermarkOpacity(0.95)).toBe(MAX_WATERMARK_OPACITY)
  })

  it('passes through valid values inside the band', () => {
    expect(clampWatermarkOpacity(0.4)).toBe(0.4)
    expect(clampWatermarkOpacity(0.55)).toBe(0.55)
  })

  it('returns the default when given NaN', () => {
    expect(clampWatermarkOpacity(Number.NaN)).toBe(DEFAULT_WATERMARK_OPACITY)
  })

  it('treats boundary values as in-range', () => {
    expect(clampWatermarkOpacity(MIN_WATERMARK_OPACITY)).toBe(MIN_WATERMARK_OPACITY)
    expect(clampWatermarkOpacity(MAX_WATERMARK_OPACITY)).toBe(MAX_WATERMARK_OPACITY)
  })
})

describe('getDefaultWatermarkText', () => {
  it('returns a non-empty localized string for known locales', () => {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en']) {
      const text = getDefaultWatermarkText(locale)
      expect(text).toBeTruthy()
      expect(text.length).toBeGreaterThan(0)
    }
  })

  it('falls back to English for unknown locales', () => {
    expect(getDefaultWatermarkText('xx-XX')).toBe(getDefaultWatermarkText('en'))
  })
})

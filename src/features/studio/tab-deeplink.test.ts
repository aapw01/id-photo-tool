import { describe, expect, it } from 'vitest'

import { parseTabParam } from './tab-deeplink'

describe('parseTabParam', () => {
  it('accepts each known tab id', () => {
    expect(parseTabParam('background')).toBe('background')
    expect(parseTabParam('size')).toBe('size')
    expect(parseTabParam('layout')).toBe('layout')
    expect(parseTabParam('export')).toBe('export')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(parseTabParam('Background')).toBe('background')
    expect(parseTabParam(' EXPORT ')).toBe('export')
  })

  it('returns null for unknown values', () => {
    expect(parseTabParam('history')).toBeNull()
    expect(parseTabParam('foo')).toBeNull()
  })

  it('returns null for empty / null / undefined / non-string input', () => {
    expect(parseTabParam('')).toBeNull()
    expect(parseTabParam(null)).toBeNull()
    expect(parseTabParam(undefined)).toBeNull()
    expect(parseTabParam(42 as unknown as string)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { coverCrop, positiveInt } from './quick-tools-utils'

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

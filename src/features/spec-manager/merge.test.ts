import { describe, expect, it } from 'vitest'

import { mergeById, mergePhotoSpecs } from './merge'
import type { PhotoSpec } from '@/types/spec'

function photoSpec(id: string, overrides: Partial<PhotoSpec> = {}): PhotoSpec {
  return {
    id,
    builtin: true,
    category: 'custom',
    name: { zh: id, 'zh-Hant': id, en: id },
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    ...overrides,
  }
}

describe('mergeById', () => {
  it('returns the builtin list as-is when there are no user overrides', () => {
    const builtins = [photoSpec('a'), photoSpec('b')]
    expect(mergeById(builtins, [])).toEqual(builtins)
  })

  it('appends user-only entries after builtins', () => {
    const builtins = [photoSpec('a')]
    const user = [photoSpec('z', { builtin: false })]
    const merged = mergeById(builtins, user)
    expect(merged.map((s) => s.id)).toEqual(['a', 'z'])
  })

  it('lets user entries with the same id replace the builtin in place', () => {
    const builtins = [photoSpec('a'), photoSpec('b'), photoSpec('c')]
    const overridden = photoSpec('b', { builtin: false, name: { zh: 'B2', 'zh-Hant': 'B2', en: 'B2' } })
    const merged = mergeById(builtins, [overridden])
    expect(merged.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(merged[1]).toBe(overridden)
    expect(merged[1]?.name.en).toBe('B2')
    expect(merged[1]?.builtin).toBe(false)
  })

  it('handles user-only list', () => {
    const user = [photoSpec('u1', { builtin: false }), photoSpec('u2', { builtin: false })]
    expect(mergeById([], user)).toEqual(user)
  })

  it('handles empty inputs', () => {
    expect(mergeById([], [])).toEqual([])
  })
})

describe('mergePhotoSpecs', () => {
  it('is a thin alias of mergeById', () => {
    const builtins = [photoSpec('a'), photoSpec('b')]
    const user = [photoSpec('b', { builtin: false, width_mm: 99 })]
    const merged = mergePhotoSpecs(builtins, user)
    expect(merged[1]?.width_mm).toBe(99)
    expect(merged).toHaveLength(2)
  })
})

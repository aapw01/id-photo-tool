import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { PhotoSpec } from '@/types/spec'

import { groupPhotoSpecsByCategory, PHOTO_CATEGORY_DISPLAY_ORDER } from './group-photo-specs'

describe('groupPhotoSpecsByCategory', () => {
  it('returns one group per non-empty category in display order', () => {
    const groups = groupPhotoSpecsByCategory()
    const categories = groups.map((g) => g.category)
    const expected = PHOTO_CATEGORY_DISPLAY_ORDER.filter((c) =>
      BUILTIN_PHOTO_SPECS.some((s) => s.category === c),
    )
    expect(categories).toEqual(expected)
    expect(groups.every((g) => g.specs.length > 0)).toBe(true)
  })

  it('does not lose any spec across grouping', () => {
    const groups = groupPhotoSpecsByCategory()
    const total = groups.reduce((acc, g) => acc + g.specs.length, 0)
    expect(total).toBe(BUILTIN_PHOTO_SPECS.length)
  })

  it('honours custom display order when passed a synthetic list', () => {
    const synth: PhotoSpec[] = [
      { ...BUILTIN_PHOTO_SPECS[0]!, id: 'a', category: 'exam' },
      { ...BUILTIN_PHOTO_SPECS[0]!, id: 'b', category: 'cn-id' },
      { ...BUILTIN_PHOTO_SPECS[0]!, id: 'c', category: 'exam' },
    ]
    const groups = groupPhotoSpecsByCategory(synth)
    expect(groups.map((g) => g.category)).toEqual(['cn-id', 'exam'])
    expect(groups[1]!.specs.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

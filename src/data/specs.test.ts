import { describe, expect, it } from 'vitest'

import { BUILTIN_PAPER_SPECS, getPaperSpec } from '@/data/paper-specs'
import { BUILTIN_PHOTO_SPECS, getPhotoSpec } from '@/data/photo-specs'
import {
  PaperSpecSchema,
  PhotoSpecSchema,
  PHOTO_CATEGORIES,
  type PhotoCategory,
} from '@/types/spec'

describe('BUILTIN_PHOTO_SPECS', () => {
  it('has around 28 entries (PRD §9.1.3 = "≈28")', () => {
    // The PRD says "合计：≈ 28 条". Allow ±2 wiggle so we don't have
    // to bump this test every time the spec list grows.
    const n = BUILTIN_PHOTO_SPECS.length
    expect(n).toBeGreaterThanOrEqual(26)
    expect(n).toBeLessThanOrEqual(30)
  })

  it('ids are unique', () => {
    const ids = BUILTIN_PHOTO_SPECS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all entries validate against PhotoSpecSchema', () => {
    for (const spec of BUILTIN_PHOTO_SPECS) {
      const parsed = PhotoSpecSchema.safeParse(spec)
      if (!parsed.success) {
        // Surface the first error verbatim — much easier to debug than
        // a generic "expected success" failure.
        throw new Error(`${spec.id} failed validation: ${JSON.stringify(parsed.error.format())}`)
      }
    }
  })

  it('covers every non-custom category at least once', () => {
    const needed = PHOTO_CATEGORIES.filter(
      (c): c is Exclude<PhotoCategory, 'custom'> => c !== 'custom',
    )
    for (const cat of needed) {
      const found = BUILTIN_PHOTO_SPECS.some((s) => s.category === cat)
      expect(found, `category ${cat} should have at least 1 entry`).toBe(true)
    }
  })

  it('every spec is marked builtin: true', () => {
    expect(BUILTIN_PHOTO_SPECS.every((s) => s.builtin === true)).toBe(true)
  })

  it('every visa spec includes background.recommended', () => {
    for (const s of BUILTIN_PHOTO_SPECS.filter((x) => x.category === 'visa')) {
      expect(s.background?.recommended, s.id).toBeTruthy()
    }
  })

  it('every exam spec specifies fileRules', () => {
    for (const s of BUILTIN_PHOTO_SPECS.filter((x) => x.category === 'exam')) {
      expect(s.fileRules, s.id).toBeTruthy()
    }
  })

  it('getPhotoSpec returns the matching spec', () => {
    expect(getPhotoSpec('us-visa')?.region).toBe('US')
    expect(getPhotoSpec('does-not-exist')).toBeNull()
  })
})

describe('BUILTIN_PAPER_SPECS', () => {
  it('has 7 entries (PRD §5.5.2)', () => {
    expect(BUILTIN_PAPER_SPECS).toHaveLength(7)
  })

  it('ids are unique', () => {
    const ids = BUILTIN_PAPER_SPECS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all entries validate against PaperSpecSchema', () => {
    for (const p of BUILTIN_PAPER_SPECS) {
      const parsed = PaperSpecSchema.safeParse(p)
      if (!parsed.success) {
        throw new Error(`${p.id} failed: ${JSON.stringify(parsed.error.format())}`)
      }
    }
  })

  it('contains the four canonical Chinese sizes + A4/A5', () => {
    const ids = BUILTIN_PAPER_SPECS.map((p) => p.id)
    for (const want of ['3R', '4R', '5R', '6R', '8R', 'A4', 'A5']) {
      expect(ids).toContain(want)
    }
  })

  it('getPaperSpec returns the matching spec', () => {
    expect(getPaperSpec('A4')?.width_mm).toBe(210)
    expect(getPaperSpec('nope')).toBeNull()
  })
})

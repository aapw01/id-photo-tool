import { describe, expect, it } from 'vitest'

import {
  BUILTIN_LAYOUT_TEMPLATES,
  getLayoutTemplate,
  getLayoutTemplatesForPaper,
} from './layout-templates'
import { BUILTIN_PAPER_SPECS } from './paper-specs'
import { BUILTIN_PHOTO_SPECS } from './photo-specs'
import { LayoutTemplateSchema } from '@/types/spec'

describe('BUILTIN_LAYOUT_TEMPLATES', () => {
  it('has at least 12 templates per PRD §5.6.2', () => {
    expect(BUILTIN_LAYOUT_TEMPLATES.length).toBeGreaterThanOrEqual(12)
  })

  it('ids are unique', () => {
    const ids = BUILTIN_LAYOUT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every template passes zod', () => {
    for (const t of BUILTIN_LAYOUT_TEMPLATES) {
      const result = LayoutTemplateSchema.safeParse(t)
      if (!result.success) {
        throw new Error(`Template ${t.id} failed zod: ${result.error.message}`)
      }
    }
  })

  it('every paperId resolves to a builtin PaperSpec', () => {
    const paperIds = new Set(BUILTIN_PAPER_SPECS.map((p) => p.id))
    for (const t of BUILTIN_LAYOUT_TEMPLATES) {
      expect(paperIds.has(t.paperId)).toBe(true)
    }
  })

  it('every items[].photoSpecId resolves to a builtin PhotoSpec', () => {
    const photoIds = new Set(BUILTIN_PHOTO_SPECS.map((p) => p.id))
    for (const t of BUILTIN_LAYOUT_TEMPLATES) {
      for (const item of t.items) {
        expect(photoIds.has(item.photoSpecId)).toBe(true)
      }
    }
  })

  it('all builtin flags are true', () => {
    for (const t of BUILTIN_LAYOUT_TEMPLATES) {
      expect(t.builtin).toBe(true)
    }
  })

  it('counts are positive integers', () => {
    for (const t of BUILTIN_LAYOUT_TEMPLATES) {
      for (const item of t.items) {
        expect(item.count).toBeGreaterThan(0)
        expect(Number.isInteger(item.count)).toBe(true)
      }
    }
  })

  it('covers both 5R and 6R papers (the canonical print sizes)', () => {
    const papersUsed = new Set(BUILTIN_LAYOUT_TEMPLATES.map((t) => t.paperId))
    expect(papersUsed.has('5R')).toBe(true)
    expect(papersUsed.has('6R')).toBe(true)
  })

  it('includes at least one A4 catch-all template', () => {
    expect(BUILTIN_LAYOUT_TEMPLATES.some((t) => t.paperId === 'A4')).toBe(true)
  })

  it('includes at least two mixed-spec templates', () => {
    const mixed = BUILTIN_LAYOUT_TEMPLATES.filter((t) => t.items.length > 1)
    expect(mixed.length).toBeGreaterThanOrEqual(2)
  })
})

describe('getLayoutTemplate', () => {
  it('returns null for unknown id', () => {
    expect(getLayoutTemplate('not-a-template')).toBeNull()
  })

  it('returns the matching template by id', () => {
    const t = getLayoutTemplate('8x1inch-on-5R')
    expect(t?.paperId).toBe('5R')
    expect(t?.items[0]!.count).toBe(8)
  })
})

describe('getLayoutTemplatesForPaper', () => {
  it('returns only templates whose paperId matches', () => {
    const found = getLayoutTemplatesForPaper('5R')
    expect(found.length).toBeGreaterThan(0)
    for (const t of found) {
      expect(t.paperId).toBe('5R')
    }
  })

  it('returns an empty list for unknown paper', () => {
    expect(getLayoutTemplatesForPaper('XX')).toEqual([])
  })
})

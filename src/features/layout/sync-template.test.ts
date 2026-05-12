import { describe, expect, it } from 'vitest'

import { BUILTIN_PAPER_SPECS } from '@/data/paper-specs'
import { getPhotoSpec } from '@/data/photo-specs'
import {
  estimateMaxCount,
  isSyncedTemplate,
  pickTemplateForSpec,
  templateAlreadyCoversSpec,
} from '@/features/layout/sync-template'
import type { PaperSpec, PhotoSpec } from '@/types/spec'

const paper5R = BUILTIN_PAPER_SPECS.find((p) => p.id === '5R')!
const paper6R = BUILTIN_PAPER_SPECS.find((p) => p.id === '6R')!
const oneInch = getPhotoSpec('cn-1inch')!
const usVisa = getPhotoSpec('us-visa')!

function customSpec(): PhotoSpec {
  return {
    id: 'custom-1234567890',
    builtin: false,
    category: 'custom',
    name: { zh: '自定义 35×49mm', 'zh-Hant': '自訂 35×49mm', en: 'Custom 35×49mm' },
    width_mm: 35,
    height_mm: 49,
    dpi: 300,
  }
}

describe('estimateMaxCount', () => {
  it('returns the most photos that physically fit a paper', () => {
    // 5R = 178 × 127 mm, cn-1inch = 25 × 35 mm, gap 2 mm, margin 5 mm.
    // usable = 168 × 117. cols = floor((168+2)/(25+2)) = 6, rows = 3 → 18.
    // rotated grid (35×25) = floor((168+2)/(35+2)) × floor((117+2)/(25+2))
    //                     = 4 × 4 = 16.
    // best of the two clamped to <= MAX_COUNT (24).
    const count = estimateMaxCount(oneInch, paper5R)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(24)
    // Spec assertion: ≥ the 8 from the built-in "5R · 8 × 1-inch" — we
    // know cn-1inch fits more than 8 cells on 5R.
    expect(count).toBeGreaterThanOrEqual(8)
  })

  it('caps oversized specs to at least 1', () => {
    const huge: PhotoSpec = {
      ...oneInch,
      id: 'huge',
      width_mm: 500,
      height_mm: 500,
    }
    expect(estimateMaxCount(huge, paper5R)).toBe(1)
  })
})

describe('pickTemplateForSpec', () => {
  it('returns the matching built-in single-spec template when available', () => {
    const template = pickTemplateForSpec(oneInch, paper5R)
    expect(template.id).toBe('8x1inch-on-5R')
    expect(template.builtin).toBe(true)
    expect(isSyncedTemplate(template)).toBe(false)
  })

  it('synthesises a custom-mix template for specs without a built-in match', () => {
    const template = pickTemplateForSpec(usVisa, paper5R)
    expect(template.builtin).toBe(false)
    expect(isSyncedTemplate(template)).toBe(true)
    expect(template.items).toHaveLength(1)
    expect(template.items[0]?.photoSpecId).toBe('us-visa')
    expect(template.items[0]?.count).toBeGreaterThan(0)
    expect(template.paperId).toBe('5R')
    expect(template.arrangement.kind).toBe('auto-grid')
  })

  it('synthesises for inline-custom specs and embeds the spec id', () => {
    const spec = customSpec()
    const template = pickTemplateForSpec(spec, paper6R)
    expect(template.items[0]?.photoSpecId).toBe(spec.id)
    expect(template.id).toContain(spec.id)
    expect(template.id).toContain(paper6R.id)
  })

  it('switches paperId when a different paper is requested', () => {
    const t5 = pickTemplateForSpec(usVisa, paper5R)
    const t6 = pickTemplateForSpec(usVisa, paper6R)
    expect(t5.paperId).toBe('5R')
    expect(t6.paperId).toBe('6R')
  })
})

describe('templateAlreadyCoversSpec', () => {
  it('returns true when paper matches and items reference the spec', () => {
    const builtin = pickTemplateForSpec(oneInch, paper5R)
    expect(templateAlreadyCoversSpec(builtin, oneInch, paper5R)).toBe(true)
  })

  it('returns false when paper differs', () => {
    const builtin = pickTemplateForSpec(oneInch, paper5R)
    expect(templateAlreadyCoversSpec(builtin, oneInch, paper6R)).toBe(false)
  })

  it('returns false when spec is missing from items', () => {
    const builtin = pickTemplateForSpec(oneInch, paper5R)
    expect(templateAlreadyCoversSpec(builtin, usVisa, paper5R)).toBe(false)
  })

  it('handles synthesised templates the same way', () => {
    const synth = pickTemplateForSpec(usVisa, paper5R)
    expect(templateAlreadyCoversSpec(synth, usVisa, paper5R)).toBe(true)
    expect(templateAlreadyCoversSpec(synth, oneInch, paper5R)).toBe(false)
  })

  it('handles inline-custom specs by id, not by builtin set', () => {
    const spec = customSpec()
    const synth = pickTemplateForSpec(spec, paper5R)
    expect(templateAlreadyCoversSpec(synth, spec, paper5R)).toBe(true)
  })
})

describe('synced template name reflects spec and paper', () => {
  it('includes the spec name in all three locales', () => {
    const template = pickTemplateForSpec(usVisa, paper5R)
    // Built-in usVisa name = '美国签证' / '美國簽證' / 'US visa'.
    expect(template.name.zh).toContain('美国签证')
    expect(template.name['zh-Hant']).toContain('美國簽證')
    expect(template.name.en).toContain('US visa')
  })
})

// Type-only sanity: builds expect the function to accept PhotoSpec /
// PaperSpec — leave this as a typecheck hint, not a runtime test.
const _typeHint: (s: PhotoSpec, p: PaperSpec) => unknown = pickTemplateForSpec
void _typeHint

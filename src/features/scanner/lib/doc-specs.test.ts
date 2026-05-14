import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DOC_SPEC_ID,
  DOC_SPECS,
  DOC_SPEC_GROUP_ORDER,
  getDocSpec,
  getOutputPixels,
  groupDocSpecs,
  type DocSpecGroup,
} from './doc-specs'

describe('doc-specs catalog', () => {
  it('exposes a non-empty catalog with stable ids', () => {
    expect(DOC_SPECS.length).toBeGreaterThan(0)
    const ids = DOC_SPECS.map((s) => s.id)
    const dedup = new Set(ids)
    expect(dedup.size).toBe(ids.length) // no duplicates
  })

  it('contains the default cn-id-card with CR80 dimensions', () => {
    const spec = getDocSpec(DEFAULT_DOC_SPEC_ID)
    expect(spec.id).toBe('cn-id-card')
    expect(spec.widthMm).toBeCloseTo(85.6, 1)
    expect(spec.heightMm).toBeCloseTo(54, 1)
    expect(spec.hasBack).toBe(true)
  })

  it('falls back to the first spec when given an unknown id', () => {
    const spec = getDocSpec('does-not-exist')
    expect(spec.id).toBe(DOC_SPECS[0]!.id)
  })

  it('falls back when id is null / undefined', () => {
    expect(getDocSpec(null).id).toBe(DOC_SPECS[0]!.id)
    expect(getDocSpec(undefined).id).toBe(DOC_SPECS[0]!.id)
  })

  it('converts mm dimensions to pixel size at 300 DPI by default', () => {
    // CR80: 85.6 mm = 85.6/25.4 in = ~3.37 in, ×300 ≈ 1011 px
    const { width, height } = getOutputPixels(getDocSpec('cn-id-card'))
    expect(width).toBe(1011)
    expect(height).toBe(638)
  })

  it('respects custom DPI', () => {
    const { width, height } = getOutputPixels(getDocSpec('cn-id-card'), 600)
    expect(width).toBe(2022)
    expect(height).toBe(1276)
  })

  it('a4 spec maps to the expected pixel size at 300 DPI', () => {
    const { width, height } = getOutputPixels(getDocSpec('a4'))
    // 210 / 25.4 * 300 = 2480.31 → 2480
    expect(width).toBe(2480)
    // 297 / 25.4 * 300 = 3507.87 → 3508
    expect(height).toBe(3508)
  })

  it('every spec belongs to a known group', () => {
    const valid: ReadonlySet<DocSpecGroup> = new Set(DOC_SPEC_GROUP_ORDER)
    for (const spec of DOC_SPECS) {
      expect(valid.has(spec.group)).toBe(true)
    }
  })

  it('every group in DOC_SPEC_GROUP_ORDER has at least one spec — no orphan headers', () => {
    for (const group of DOC_SPEC_GROUP_ORDER) {
      const matched = DOC_SPECS.filter((s) => s.group === group)
      expect(matched.length, `group ${group} has no specs`).toBeGreaterThan(0)
    }
  })

  it('covers the five core jurisdictions for ID-card scans', () => {
    const ids = new Set(DOC_SPECS.map((s) => s.id))
    for (const required of [
      'cn-id-card',
      'hk-id-card',
      'tw-id-card',
      'sg-nric',
      'in-aadhaar',
      'us-driver-license',
    ]) {
      expect(ids.has(required), `missing required spec: ${required}`).toBe(true)
    }
  })
})

describe('groupDocSpecs', () => {
  it('preserves the canonical group order — id-card first, paper last', () => {
    const groups = groupDocSpecs()
    expect(groups[0]?.group).toBe('id-card')
    expect(groups[groups.length - 1]?.group).toBe('paper')
  })

  it('returns every catalog entry exactly once across the groups', () => {
    const groups = groupDocSpecs()
    const flattenedIds = groups.flatMap((g) => g.specs.map((s) => s.id))
    expect(flattenedIds).toHaveLength(DOC_SPECS.length)
    expect(new Set(flattenedIds).size).toBe(DOC_SPECS.length)
  })

  it('drops groups with zero specs so the picker has no empty headers', () => {
    const subset = DOC_SPECS.filter((s) => s.group === 'id-card')
    const groups = groupDocSpecs(subset)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.group).toBe('id-card')
  })

  it('returns each group with at least one spec', () => {
    for (const { group, specs } of groupDocSpecs()) {
      expect(specs.length, `group ${group} returned empty`).toBeGreaterThan(0)
    }
  })
})

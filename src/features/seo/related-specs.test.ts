import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS } from '@/features/scanner/lib/doc-specs'

import { getRelatedDocSpecs, getRelatedSpecs } from './related-specs'

describe('getRelatedSpecs', () => {
  it('returns an empty list for an unknown spec', () => {
    expect(getRelatedSpecs('not-a-real-spec')).toEqual([])
  })

  it('never includes the active spec itself', () => {
    const related = getRelatedSpecs('us-visa')
    expect(related.find((s) => s.id === 'us-visa')).toBeUndefined()
  })

  it('returns between 4 and 6 related specs by default', () => {
    const related = getRelatedSpecs('us-visa')
    expect(related.length).toBeGreaterThanOrEqual(4)
    expect(related.length).toBeLessThanOrEqual(6)
  })

  it('prefers same-region specs when the spec has a region', () => {
    // Pick a region with multiple representatives so the test is
    // meaningful. China has 7 cn-id + 2 cn-paper + 2 travel-permit +
    // 3 exam = 14 entries, far more than the limit.
    const related = getRelatedSpecs('cn-id-card')
    // The first 4 results should all be CN-region specs.
    const firstFour = related.slice(0, 4)
    expect(firstFour.every((s) => s.region === 'CN')).toBe(true)
  })

  it('honours the size-bucket tier when the region tier is short', () => {
    // 'us-visa' is the only US-region spec; the next tier picks specs
    // sharing the same physical size bucket (51×51).
    const related = getRelatedSpecs('us-visa')
    const usCount = related.filter((s) => s.region === 'US').length
    expect(usCount).toBe(0) // 'us-visa' is the only US spec
    // The 51×51 bucket includes 'in-visa'; assert at least one
    // sibling from that bucket lands in the row.
    expect(related.some((s) => s.id === 'in-visa')).toBe(true)
  })

  it('is deterministic — same input produces same ordered output', () => {
    const a = getRelatedSpecs('schengen').map((s) => s.id)
    const b = getRelatedSpecs('schengen').map((s) => s.id)
    expect(a).toEqual(b)
  })

  it('does not exceed the requested limit', () => {
    const limited = getRelatedSpecs('schengen', 4)
    expect(limited.length).toBe(4)
  })

  it('only returns specs that exist in the built-in catalog', () => {
    const ids = new Set(BUILTIN_PHOTO_SPECS.map((s) => s.id))
    const related = getRelatedSpecs('schengen')
    for (const spec of related) {
      expect(ids.has(spec.id)).toBe(true)
    }
  })
})

describe('getRelatedDocSpecs', () => {
  it('returns an empty list for an unknown doc-type', () => {
    expect(getRelatedDocSpecs('not-a-real-doc')).toEqual([])
  })

  it('never includes the active doc-type itself', () => {
    const related = getRelatedDocSpecs('cn-id-card')
    expect(related.find((s) => s.id === 'cn-id-card')).toBeUndefined()
  })

  it('returns between 4 and 6 related doc-types by default', () => {
    const related = getRelatedDocSpecs('cn-id-card')
    expect(related.length).toBeGreaterThanOrEqual(4)
    expect(related.length).toBeLessThanOrEqual(6)
  })

  it('prefers same-group doc-types first', () => {
    // 'cn-id-card' is in the 'id-card' group which has 6 siblings —
    // the first 5 results should all be 'id-card' group entries.
    const related = getRelatedDocSpecs('cn-id-card')
    const firstFive = related.slice(0, 5)
    expect(firstFive.every((s) => s.group === 'id-card')).toBe(true)
  })

  it('falls back to other groups once the same-group tier is exhausted', () => {
    // 'passport-bio' is the only entry in the 'passport' group; the
    // helper must pull from other groups to reach the >=4 minimum.
    const related = getRelatedDocSpecs('passport-bio')
    expect(related.length).toBeGreaterThanOrEqual(4)
    expect(related.some((s) => s.group !== 'passport')).toBe(true)
  })

  it('is deterministic — same input produces same ordered output', () => {
    const a = getRelatedDocSpecs('passport-bio').map((s) => s.id)
    const b = getRelatedDocSpecs('passport-bio').map((s) => s.id)
    expect(a).toEqual(b)
  })

  it('only returns doc-types that exist in DOC_SPECS', () => {
    const ids = new Set(DOC_SPECS.map((s) => s.id))
    const related = getRelatedDocSpecs('cn-id-card')
    for (const spec of related) {
      expect(ids.has(spec.id)).toBe(true)
    }
  })

  it('does not exceed the requested limit', () => {
    const limited = getRelatedDocSpecs('cn-id-card', 4)
    expect(limited.length).toBe(4)
  })
})

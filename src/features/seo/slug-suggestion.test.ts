import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'
import { extractCandidateSlug, suggestSlug } from './slug-suggestion'

describe('extractCandidateSlug', () => {
  it('returns null for paths that do not look like detail pages', () => {
    expect(extractCandidateSlug('/')).toBeNull()
    expect(extractCandidateSlug('/en')).toBeNull()
    expect(extractCandidateSlug('/zh-Hans/studio')).toBeNull()
    expect(extractCandidateSlug('/foo/bar')).toBeNull()
  })

  it('peels off the locale prefix on detail-page URLs', () => {
    expect(extractCandidateSlug('/en/sizes/us-visa')).toEqual({ kind: 'spec', slug: 'us-visa' })
    expect(extractCandidateSlug('/zh-Hans/sizes/cn-id-card')).toEqual({
      kind: 'spec',
      slug: 'cn-id-card',
    })
    expect(extractCandidateSlug('/zh-Hant/scanner/passport-bio')).toEqual({
      kind: 'scannerDoc',
      slug: 'passport-bio',
    })
  })

  it('tolerates missing locale prefix', () => {
    expect(extractCandidateSlug('/sizes/us-visa')).toEqual({ kind: 'spec', slug: 'us-visa' })
    expect(extractCandidateSlug('/scanner/cn-id-card')).toEqual({
      kind: 'scannerDoc',
      slug: 'cn-id-card',
    })
  })

  it('strips query strings + fragments', () => {
    expect(extractCandidateSlug('/en/sizes/us-visa?ref=abc#x')).toEqual({
      kind: 'spec',
      slug: 'us-visa',
    })
  })
})

describe('suggestSlug', () => {
  it('returns null when there is no candidate', () => {
    expect(suggestSlug('/')).toBeNull()
    expect(suggestSlug('/en/studio')).toBeNull()
  })

  it('returns the exact match when the slug is real', () => {
    const suggestion = suggestSlug('/en/sizes/us-visa')
    expect(suggestion?.kind).toBe('spec')
    expect(suggestion?.id).toBe('us-visa')
    expect(suggestion?.path).toBe('/sizes/us-visa')
  })

  it('corrects a single typo in a spec slug', () => {
    const suggestion = suggestSlug('/en/sizes/us-vsa')
    expect(suggestion?.id).toBe('us-visa')
  })

  it('corrects a slug with one missing dash', () => {
    const suggestion = suggestSlug('/en/sizes/usvisa')
    expect(suggestion?.id).toBe('us-visa')
  })

  it('matches scanner DocSpec slugs against the scanner pool only', () => {
    const suggestion = suggestSlug('/zh-Hans/scanner/cn-id-cad')
    expect(suggestion?.kind).toBe('scannerDoc')
    expect(suggestion?.id).toBe('cn-id-card')
    expect(suggestion?.path).toBe('/scanner/cn-id-card')
  })

  it('returns null for slugs that are too far from any catalog id', () => {
    // Completely unrelated string — should not nudge the user toward
    // an arbitrary best-of-bad-matches.
    expect(suggestSlug('/en/sizes/this-is-very-much-not-a-real-photo-spec')).toBeNull()
  })

  it('only returns slugs that exist in the live catalog', () => {
    const allSpecIds = new Set(BUILTIN_PHOTO_SPECS.map((s) => s.id))
    const allDocIds = new Set(SCANNER_DOC_SPECS.map((s) => s.id))
    for (const probe of ['us-vsa', 'cn-1nch', 'schngn', 'passprt-bio']) {
      const surface = probe === 'passprt-bio' ? 'scanner' : 'sizes'
      const s = suggestSlug(`/en/${surface}/${probe}`)
      if (s) {
        if (s.kind === 'spec') expect(allSpecIds.has(s.id)).toBe(true)
        else expect(allDocIds.has(s.id)).toBe(true)
      }
    }
  })

  it('is deterministic for the same input', () => {
    const a = suggestSlug('/zh-Hant/sizes/uk-vsa')
    const b = suggestSlug('/zh-Hant/sizes/uk-vsa')
    expect(a).toEqual(b)
  })
})

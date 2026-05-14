import { describe, expect, it } from 'vitest'

import {
  buildAlternateLanguages,
  buildCanonical,
  buildMetadata,
  normalizeKeywords,
  normalizePath,
  ogLocaleFor,
} from './metadata'
import { SITE_URL, SUPPORTED_LOCALES } from './site-config'

describe('normalizePath', () => {
  it('returns `/` for root inputs', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('')).toBe('/')
  })

  it('prefixes a missing slash and strips trailing slashes', () => {
    expect(normalizePath('studio')).toBe('/studio')
    expect(normalizePath('/studio/')).toBe('/studio')
    expect(normalizePath('/sizes///')).toBe('/sizes')
  })
})

describe('buildCanonical', () => {
  it('builds locale-prefixed absolute URLs', () => {
    expect(buildCanonical('/studio', 'zh-Hans')).toBe(`${SITE_URL}/zh-Hans/studio`)
    expect(buildCanonical('/sizes', 'en')).toBe(`${SITE_URL}/en/sizes`)
  })

  it('does not append a path suffix for the home route', () => {
    expect(buildCanonical('/', 'zh-Hans')).toBe(`${SITE_URL}/zh-Hans`)
    expect(buildCanonical('', 'en')).toBe(`${SITE_URL}/en`)
  })
})

describe('buildAlternateLanguages', () => {
  it('includes every supported locale plus x-default', () => {
    const map = buildAlternateLanguages('/studio')
    expect(map['zh-Hans']).toBe(`${SITE_URL}/zh-Hans/studio`)
    expect(map['zh-Hant']).toBe(`${SITE_URL}/zh-Hant/studio`)
    expect(map['en']).toBe(`${SITE_URL}/en/studio`)
    expect(map['x-default']).toBe(`${SITE_URL}/en/studio`)
  })

  it('keys count matches 3 locales + x-default', () => {
    expect(Object.keys(buildAlternateLanguages('/'))).toHaveLength(4)
  })

  it('covers every locale defined by SUPPORTED_LOCALES + x-default exactly', () => {
    // Defensive: if a contributor extends `SUPPORTED_LOCALES`,
    // hreflang must follow. Compare set equality so the test does
    // not have to hard-code each locale.
    const map = buildAlternateLanguages('/scanner')
    const expected = new Set<string>([...SUPPORTED_LOCALES, 'x-default'])
    expect(new Set(Object.keys(map))).toEqual(expected)
  })

  it('x-default always points at the canonical English URL', () => {
    // Pixfit's x-default routes anonymous traffic to /en — Simplified
    // Chinese is the routing default but the SEO default is English so
    // visitors hitting Pixfit without a language hint land in EN.
    const map = buildAlternateLanguages('/scanner/passport-bio')
    expect(map['x-default']).toBe(`${SITE_URL}/en/scanner/passport-bio`)
  })
})

describe('buildMetadata', () => {
  it('packs title / description / canonical / alternates / og / twitter', () => {
    const meta = buildMetadata({
      locale: 'en',
      path: '/sizes',
      title: 'Pixfit Sizes',
      description: 'Browse ID photo sizes.',
    })
    expect(meta.title).toBe('Pixfit Sizes')
    expect(meta.description).toBe('Browse ID photo sizes.')
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/en/sizes`)
    const langs = meta.alternates?.languages as Record<string, string>
    expect(langs['zh-Hans']).toBe(`${SITE_URL}/zh-Hans/sizes`)
    expect(meta.openGraph?.url).toBe(`${SITE_URL}/en/sizes`)
    expect(meta.openGraph?.locale).toBe('en_US')
    const twitter = meta.twitter as { card?: string } | null | undefined
    expect(twitter?.card).toBe('summary_large_image')
  })

  it('marks no-index when requested', () => {
    const meta = buildMetadata({
      locale: 'zh-Hans',
      path: '/dev',
      title: 'Dev',
      description: 'internal',
      noIndex: true,
    })
    expect(meta.robots).toMatchObject({ index: false, follow: false })
  })

  it('accepts an external og image URL untouched', () => {
    const meta = buildMetadata({
      locale: 'zh-Hans',
      path: '/',
      title: 'Pixfit',
      description: 'hi',
      image: 'https://cdn.example.com/og.png',
    })
    const images = meta.openGraph?.images as Array<{ url: string }>
    expect(images[0]?.url).toBe('https://cdn.example.com/og.png')
  })

  it('passes the keywords array straight through to the Metadata block', () => {
    const meta = buildMetadata({
      locale: 'zh-Hans',
      path: '/',
      title: 'Pixfit',
      description: 'hi',
      keywords: ['智能证件照处理', 'AI 一键抠图', 'AI 证件照'],
    })
    expect(meta.keywords).toEqual(['智能证件照处理', 'AI 一键抠图', 'AI 证件照'])
  })

  it('accepts a comma-joined keyword string and dedupes case-insensitively', () => {
    const meta = buildMetadata({
      locale: 'en',
      path: '/scanner',
      title: 'Scanner',
      description: 'Scanner desc.',
      keywords: 'AI document scanner, ai document scanner ,smart document scanner',
    })
    expect(meta.keywords).toEqual(['AI document scanner', 'smart document scanner'])
  })

  it('omits the keywords field entirely when no input is provided', () => {
    const meta = buildMetadata({
      locale: 'en',
      path: '/',
      title: 'Pixfit',
      description: 'hi',
    })
    expect('keywords' in meta).toBe(false)
  })

  it('renders titleAbsolute as `{ absolute: title }` so the root template skips it', () => {
    const meta = buildMetadata({
      locale: 'en',
      path: '/',
      title: 'Pixfit · The brand',
      description: 'hi',
      titleAbsolute: true,
    })
    expect(meta.title).toEqual({ absolute: 'Pixfit · The brand' })
  })
})

describe('normalizeKeywords', () => {
  it('returns undefined for undefined / empty input', () => {
    expect(normalizeKeywords(undefined)).toBeUndefined()
    expect(normalizeKeywords([])).toBeUndefined()
    expect(normalizeKeywords('')).toBeUndefined()
  })

  it('trims whitespace and drops empty entries', () => {
    expect(normalizeKeywords(['  foo  ', '', 'bar'])).toEqual(['foo', 'bar'])
  })

  it('dedupes case-insensitively but preserves the first casing seen', () => {
    expect(normalizeKeywords(['AI 证件照', 'ai 证件照', 'AI 证件照'])).toEqual(['AI 证件照'])
  })
})

describe('ogLocaleFor', () => {
  it('maps each locale to its og territory code', () => {
    expect(ogLocaleFor('zh-Hans')).toBe('zh_CN')
    expect(ogLocaleFor('zh-Hant')).toBe('zh_TW')
    expect(ogLocaleFor('en')).toBe('en_US')
  })
})

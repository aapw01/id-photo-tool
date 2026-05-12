import { describe, expect, it } from 'vitest'

import {
  buildAlternateLanguages,
  buildCanonical,
  buildMetadata,
  normalizePath,
  ogLocaleFor,
} from './metadata'
import { SITE_URL } from './site-config'

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
    expect(map['x-default']).toBe(`${SITE_URL}/zh-Hans/studio`)
  })

  it('keys count matches 3 locales + x-default', () => {
    expect(Object.keys(buildAlternateLanguages('/'))).toHaveLength(4)
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
})

describe('ogLocaleFor', () => {
  it('maps each locale to its og territory code', () => {
    expect(ogLocaleFor('zh-Hans')).toBe('zh_CN')
    expect(ogLocaleFor('zh-Hant')).toBe('zh_TW')
    expect(ogLocaleFor('en')).toBe('en_US')
  })
})

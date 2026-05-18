import { describe, expect, it } from 'vitest'

import { BLOG_POSTS } from '@/content/blog'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { COMPRESS_TARGETS } from '@/features/compress/targets'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'
import {
  blogPostRoutes,
  buildSitemapEntries,
  compressTargetRoutes,
  SEO_LASTMOD,
  SITEMAP_ROUTES,
  scannerDocTypeRoutes,
  specDetailRoutes,
} from './sitemap-entries'
import { SITE_URL, SUPPORTED_LOCALES } from './site-config'

const LOCALE_COUNT = SUPPORTED_LOCALES.length

describe('buildSitemapEntries', () => {
  const fixed = new Date('2026-05-12T12:00:00Z')

  it('emits one entry per route × locale, including spec/scanner/compress/blog detail pages', () => {
    const entries = buildSitemapEntries(fixed)
    const expected =
      (SITEMAP_ROUTES.length +
        BUILTIN_PHOTO_SPECS.length +
        SCANNER_DOC_SPECS.length +
        COMPRESS_TARGETS.length +
        BLOG_POSTS.length) *
      LOCALE_COUNT
    expect(entries).toHaveLength(expected)
  })

  it('emits the /blog index + every article URL per locale', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    for (const locale of SUPPORTED_LOCALES) {
      expect(urls).toContain(`${SITE_URL}/${locale}/blog`)
      for (const post of BLOG_POSTS) {
        expect(urls).toContain(`${SITE_URL}/${locale}/blog/${post.slug}`)
      }
    }
    expect(blogPostRoutes().every((r) => r.priority === 0.7)).toBe(true)
  })

  it('emits the /compress index across locales', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    for (const locale of SUPPORTED_LOCALES) {
      expect(urls).toContain(`${SITE_URL}/${locale}/compress`)
    }
  })

  it('emits one /compress/[target] URL per target × locale (15 total)', () => {
    const entries = buildSitemapEntries(fixed)
    const compressDetail = entries.filter(
      (e) => /\/compress\/[^/]+$/.test(e.url) && !e.url.endsWith('/compress'),
    )
    expect(compressDetail).toHaveLength(COMPRESS_TARGETS.length * LOCALE_COUNT)
    expect(compressTargetRoutes().every((r) => r.priority === 0.8)).toBe(true)
  })

  it('emits one scanner DocType URL × locale + one size detail URL × locale', () => {
    const entries = buildSitemapEntries(fixed)
    const scannerDetailEntries = entries.filter(
      (e) => /\/scanner\/[^/]+$/.test(e.url) && !e.url.endsWith('/scanner'),
    )
    const sizeDetailEntries = entries.filter(
      (e) => /\/sizes\/[^/]+$/.test(e.url) && !e.url.endsWith('/sizes'),
    )
    // Pin against data-derived expectations so this test fails the
    // day the catalog or locale list changes instead of silently
    // drifting.
    expect(scannerDetailEntries).toHaveLength(SCANNER_DOC_SPECS.length * LOCALE_COUNT)
    expect(sizeDetailEntries).toHaveLength(BUILTIN_PHOTO_SPECS.length * LOCALE_COUNT)
  })

  it('emits the per-spec detail URL into the sitemap', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/en/sizes/us-visa`)
    expect(urls).toContain(`${SITE_URL}/zh-Hans/sizes/cn-id-card`)
    expect(urls).toContain(`${SITE_URL}/zh-Hant/sizes/schengen`)
  })

  it('populates hreflang alternates covering every supported locale + x-default on every entry', () => {
    const entries = buildSitemapEntries(fixed)
    for (const entry of entries) {
      const langs = entry.alternates?.languages as Record<string, string> | undefined
      expect(langs).toBeDefined()
      for (const locale of SUPPORTED_LOCALES) {
        expect(langs?.[locale]).toMatch(`${SITE_URL}/${locale}`)
      }
      expect(langs?.['x-default']).toMatch(`${SITE_URL}/en`)
    }
  })

  it('puts the home route at the highest priority', () => {
    const entries = buildSitemapEntries(fixed)
    const home = entries.find((e) => e.url === `${SITE_URL}/zh-Hans`)
    expect(home?.priority).toBe(1)
    expect(home?.lastModified).toBe(fixed)
  })

  it('honours the agreed priority tiers', () => {
    const find = (path: string) => SITEMAP_ROUTES.find((r) => r.path === path)
    expect(find('/')?.priority).toBe(1.0)
    expect(find('/studio')?.priority).toBe(0.9)
    expect(find('/scanner')?.priority).toBe(0.9)
    expect(find('/sizes')?.priority).toBe(0.7)
    expect(find('/paper')?.priority).toBe(0.7)
    expect(find('/templates')?.priority).toBe(0.7)
    expect(find('/specs')?.priority).toBe(0.7)
    expect(find('/privacy')?.priority).toBe(0.5)
    expect(find('/terms')?.priority).toBe(0.5)
    expect(specDetailRoutes().every((r) => r.priority === 0.8)).toBe(true)
    expect(scannerDocTypeRoutes().every((r) => r.priority === 0.8)).toBe(true)
  })

  it('uses weekly cadence for tool surfaces + monthly for landing hubs + yearly for legal', () => {
    const cf = (path: string) => SITEMAP_ROUTES.find((r) => r.path === path)?.changeFrequency
    expect(cf('/')).toBe('weekly')
    expect(cf('/studio')).toBe('weekly')
    expect(cf('/scanner')).toBe('weekly')
    expect(cf('/sizes')).toBe('monthly')
    expect(cf('/paper')).toBe('monthly')
    expect(cf('/templates')).toBe('monthly')
    expect(cf('/specs')).toBe('monthly')
    expect(cf('/privacy')).toBe('yearly')
    expect(cf('/terms')).toBe('yearly')
    expect(specDetailRoutes().every((r) => r.changeFrequency === 'weekly')).toBe(true)
    expect(scannerDocTypeRoutes().every((r) => r.changeFrequency === 'weekly')).toBe(true)
  })

  it('covers the legal pages', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/en/privacy`)
    expect(urls).toContain(`${SITE_URL}/zh-Hant/terms`)
  })

  it('covers the scanner sub-product entry route across locales', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/zh-Hans/scanner`)
    expect(urls).toContain(`${SITE_URL}/zh-Hant/scanner`)
    expect(urls).toContain(`${SITE_URL}/en/scanner`)
  })

  it('covers the /specs hub across locales', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/zh-Hans/specs`)
    expect(urls).toContain(`${SITE_URL}/zh-Hant/specs`)
    expect(urls).toContain(`${SITE_URL}/en/specs`)
  })

  it('produces one scanner DocType route per built-in spec', () => {
    const routes = scannerDocTypeRoutes()
    expect(routes).toHaveLength(SCANNER_DOC_SPECS.length)
    expect(routes.every((r) => r.path.startsWith('/scanner/'))).toBe(true)
  })

  it('emits every scanner DocType URL into the sitemap', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = new Set(entries.map((e) => e.url))
    expect(urls.has(`${SITE_URL}/zh-Hans/scanner/cn-id-card`)).toBe(true)
    expect(urls.has(`${SITE_URL}/zh-Hant/scanner/tw-id-card`)).toBe(true)
    expect(urls.has(`${SITE_URL}/en/scanner/us-driver-license`)).toBe(true)
    expect(urls.has(`${SITE_URL}/en/scanner/passport-bio`)).toBe(true)
  })

  it('every scanner DocType URL carries hreflang alternates', () => {
    const entries = buildSitemapEntries(fixed)
    const scannerEntries = entries.filter(
      (e) => e.url.includes('/scanner/') && !e.url.endsWith('/scanner'),
    )
    expect(scannerEntries.length).toBe(SCANNER_DOC_SPECS.length * LOCALE_COUNT)
    for (const entry of scannerEntries) {
      const langs = entry.alternates?.languages as Record<string, string> | undefined
      expect(langs).toBeDefined()
      for (const locale of SUPPORTED_LOCALES) {
        expect(langs?.[locale]).toBeDefined()
      }
      expect(langs?.['x-default']).toBeDefined()
    }
  })

  it('exposes a SEO_LASTMOD constant for the default lastModified anchor', () => {
    const entries = buildSitemapEntries()
    expect(entries[0]?.lastModified).toBe(SEO_LASTMOD)
  })
})

import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { DOC_SPECS as SCANNER_DOC_SPECS } from '@/features/scanner/lib/doc-specs'
import {
  buildSitemapEntries,
  SITEMAP_ROUTES,
  scannerDocTypeRoutes,
  specDetailRoutes,
} from './sitemap-entries'
import { SITE_URL } from './site-config'

describe('buildSitemapEntries', () => {
  const fixed = new Date('2026-05-12T12:00:00Z')

  it('emits one entry per route × locale, including spec + scanner detail pages', () => {
    const entries = buildSitemapEntries(fixed)
    const expected =
      (SITEMAP_ROUTES.length + BUILTIN_PHOTO_SPECS.length + SCANNER_DOC_SPECS.length) * 3
    expect(entries).toHaveLength(expected)
  })

  it('produces a detail route for every built-in photo spec', () => {
    const detail = specDetailRoutes()
    expect(detail).toHaveLength(BUILTIN_PHOTO_SPECS.length)
    expect(detail[0]?.path).toMatch(/^\/sizes\//)
  })

  it('emits the per-spec detail URL into the sitemap', () => {
    const entries = buildSitemapEntries(fixed)
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/en/sizes/us-visa`)
    expect(urls).toContain(`${SITE_URL}/zh-Hans/sizes/cn-id-card`)
    expect(urls).toContain(`${SITE_URL}/zh-Hant/sizes/schengen`)
  })

  it('populates hreflang alternates on every entry', () => {
    const entries = buildSitemapEntries(fixed)
    for (const entry of entries) {
      const langs = entry.alternates?.languages as Record<string, string> | undefined
      expect(langs).toBeDefined()
      expect(langs?.['zh-Hans']).toMatch(`${SITE_URL}/zh-Hans`)
      expect(langs?.['x-default']).toMatch(`${SITE_URL}/en`)
    }
  })

  it('puts the home route at the highest priority', () => {
    const entries = buildSitemapEntries(fixed)
    const home = entries.find((e) => e.url === `${SITE_URL}/zh-Hans`)
    expect(home?.priority).toBe(1)
    expect(home?.lastModified).toBe(fixed)
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

  it('produces one scanner DocType route per built-in spec', () => {
    const routes = scannerDocTypeRoutes()
    expect(routes).toHaveLength(SCANNER_DOC_SPECS.length)
    expect(routes.every((r) => r.path.startsWith('/scanner/'))).toBe(true)
    // Per the S7 spec, scanner DocType pages are 0.7 priority — lower
    // than the primary `/sizes/[specId]` surface (0.75) but still
    // indexable for long-tail queries.
    expect(routes.every((r) => r.priority === 0.7)).toBe(true)
    expect(routes.every((r) => r.changeFrequency === 'monthly')).toBe(true)
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
    expect(scannerEntries.length).toBe(SCANNER_DOC_SPECS.length * 3)
    for (const entry of scannerEntries) {
      const langs = entry.alternates?.languages as Record<string, string> | undefined
      expect(langs).toBeDefined()
      expect(langs?.['zh-Hans']).toBeDefined()
      expect(langs?.['zh-Hant']).toBeDefined()
      expect(langs?.['en']).toBeDefined()
      expect(langs?.['x-default']).toBeDefined()
    }
  })

  it('scanner DocType priority is at most `/sizes/[specId]` priority', () => {
    // Defensive: if someone bumps scanner priority above sizes by
    // accident, the SEO ranking surface order shifts in ways the
    // product hasn't decided. Pin it.
    const scanner = scannerDocTypeRoutes()
    const sizes = specDetailRoutes()
    const maxScanner = Math.max(...scanner.map((r) => r.priority))
    const minSizes = Math.min(...sizes.map((r) => r.priority))
    expect(maxScanner).toBeLessThanOrEqual(minSizes)
  })
})

import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { buildSitemapEntries, SITEMAP_ROUTES, specDetailRoutes } from './sitemap-entries'
import { SITE_URL } from './site-config'

describe('buildSitemapEntries', () => {
  const fixed = new Date('2026-05-12T12:00:00Z')

  it('emits one entry per route × locale, including spec detail pages', () => {
    const entries = buildSitemapEntries(fixed)
    const expected = (SITEMAP_ROUTES.length + BUILTIN_PHOTO_SPECS.length) * 3
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
})

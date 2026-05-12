import { describe, expect, it } from 'vitest'

import { buildSitemapEntries, SITEMAP_ROUTES } from './sitemap-entries'
import { SITE_URL } from './site-config'

describe('buildSitemapEntries', () => {
  const fixed = new Date('2026-05-12T12:00:00Z')

  it('emits one entry per route × locale', () => {
    const entries = buildSitemapEntries(fixed)
    expect(entries).toHaveLength(SITEMAP_ROUTES.length * 3)
  })

  it('populates hreflang alternates on every entry', () => {
    const entries = buildSitemapEntries(fixed)
    for (const entry of entries) {
      const langs = entry.alternates?.languages as Record<string, string> | undefined
      expect(langs).toBeDefined()
      expect(langs?.['zh-Hans']).toMatch(`${SITE_URL}/zh-Hans`)
      expect(langs?.['x-default']).toMatch(`${SITE_URL}/zh-Hans`)
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

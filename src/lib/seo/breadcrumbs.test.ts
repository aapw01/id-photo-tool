import { describe, expect, it } from 'vitest'

import { breadcrumbItemsToJsonLd, getBreadcrumbItems, type BreadcrumbLabels } from './breadcrumbs'

const LABELS: BreadcrumbLabels = {
  home: 'Home',
  scanner: 'Scanner',
  sizes: 'Sizes',
  paper: 'Paper',
  templates: 'Templates',
  specs: 'Specs',
  privacy: 'Privacy',
  terms: 'Terms',
}

describe('getBreadcrumbItems', () => {
  it('returns Home + section for top-level index routes', () => {
    for (const route of ['scanner', 'sizes', 'paper', 'templates', 'specs'] as const) {
      const items = getBreadcrumbItems(route, { labels: LABELS })
      expect(items).toHaveLength(2)
      expect(items[0]).toEqual({ path: '/', name: 'Home' })
      expect(items[1]?.path).toBe(`/${route}`)
    }
  })

  it('appends a third hop for detail routes', () => {
    const items = getBreadcrumbItems('scanner-detail', {
      labels: LABELS,
      detail: { itemName: 'US visa', itemSlug: 'us-visa' },
    })
    expect(items).toEqual([
      { path: '/', name: 'Home' },
      { path: '/scanner', name: 'Scanner' },
      { path: '/scanner/us-visa', name: 'US visa' },
    ])
  })

  it('mirrors the JSON-LD payload from the same array', () => {
    const items = getBreadcrumbItems('sizes-detail', {
      labels: LABELS,
      detail: { itemName: '一寸照', itemSlug: 'china-1in' },
    })
    const ld = breadcrumbItemsToJsonLd(items, 'zh-Hans')
    expect(ld['@type']).toBe('BreadcrumbList')
    const elements = ld.itemListElement as Array<{ name: string; item: string; position: number }>
    expect(elements).toHaveLength(items.length)
    elements.forEach((el, idx) => {
      expect(el.position).toBe(idx + 1)
      expect(el.name).toBe(items[idx]!.name)
      // Locale prefix appears for non-default locale.
      expect(el.item).toContain('/zh-Hans')
      // Non-home entries embed the relative path as the suffix.
      if (idx > 0) {
        expect(el.item.endsWith(items[idx]!.path)).toBe(true)
      }
    })
  })

  it('throws when detail options are missing for detail routes', () => {
    expect(() => getBreadcrumbItems('scanner-detail', { labels: LABELS })).toThrow()
    expect(() => getBreadcrumbItems('sizes-detail', { labels: LABELS })).toThrow()
  })

  it('falls back to a default label when a section label is omitted', () => {
    const items = getBreadcrumbItems('paper', { labels: { home: 'Home' } })
    expect(items[1]?.name).toBe('Paper')
  })

  it('is deterministic for the same input', () => {
    const a = getBreadcrumbItems('templates', { labels: LABELS })
    const b = getBreadcrumbItems('templates', { labels: LABELS })
    expect(a).toEqual(b)
  })

  it('uses the labels object as the single source of truth for visible + JSON-LD names', () => {
    const items = getBreadcrumbItems('scanner-detail', {
      labels: { ...LABELS, scanner: 'Document scanner' },
      detail: { itemName: 'CN ID card', itemSlug: 'cn-id-card' },
    })
    // The visible UI consumes `items[i].name`.
    expect(items.map((i) => i.name)).toEqual(['Home', 'Document scanner', 'CN ID card'])
    // The JSON-LD serialiser walks the same array.
    const ld = breadcrumbItemsToJsonLd(items, 'en')
    const ldNames = (ld.itemListElement as Array<{ name: string }>).map((el) => el.name)
    expect(ldNames).toEqual(items.map((i) => i.name))
  })
})

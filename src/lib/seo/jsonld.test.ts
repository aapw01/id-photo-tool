import { describe, expect, it } from 'vitest'

import {
  breadcrumbSchema,
  itemListSchema,
  serializeJsonLd,
  webApplicationSchema,
  webSiteSchema,
} from './jsonld'
import { SITE_URL } from './site-config'

describe('webApplicationSchema', () => {
  it('sets the canonical URL and locale', () => {
    const schema = webApplicationSchema('en')
    expect(schema['@type']).toBe('WebApplication')
    expect(schema.url).toBe(`${SITE_URL}/en`)
    expect(schema.inLanguage).toBe('en')
    expect(schema.isAccessibleForFree).toBe(true)
  })

  it('omits the keywords property when no keywords are supplied', () => {
    const schema = webApplicationSchema('en')
    expect(schema.keywords).toBeUndefined()
  })

  it('renders supplied keywords as a comma-joined string for schema.org', () => {
    // schema.org `keywords` accepts a comma-delimited string OR an
    // array — we emit the string form because it round-trips the
    // cleanest through Google's rich-results validator.
    const schema = webApplicationSchema('zh-Hans', {
      keywords: ['智能证件照处理', 'AI 一键抠图证件照', '智能证件扫描'],
    })
    expect(schema.keywords).toBe('智能证件照处理, AI 一键抠图证件照, 智能证件扫描')
  })
})

describe('webSiteSchema', () => {
  it('points the canonical URL at the locale-prefixed home by default', () => {
    const schema = webSiteSchema('zh-Hans')
    expect(schema['@type']).toBe('WebSite')
    expect(schema.url).toBe(`${SITE_URL}/zh-Hans`)
    expect(schema.inLanguage).toBe('zh-Hans')
  })

  it('respects an explicit override URL when provided', () => {
    const schema = webSiteSchema('en', { url: 'https://example.com/custom' })
    expect(schema.url).toBe('https://example.com/custom')
  })

  it('mirrors the keyword cluster so brand search picks it up', () => {
    const schema = webSiteSchema('en', {
      keywords: ['intelligent ID photo', 'AI passport photo'],
    })
    expect(schema.keywords).toBe('intelligent ID photo, AI passport photo')
  })

  it('omits a SearchAction so the sitelinks search box does not get suppressed by an empty target', () => {
    // We deliberately don't ship a `potentialAction` — emitting one
    // with a stub URL pattern is worse than emitting none at all per
    // Google's structured-data guidance.
    const schema = webSiteSchema('en')
    expect(schema.potentialAction).toBeUndefined()
  })
})

describe('itemListSchema', () => {
  it('packs items as ListItem with 1-based position', () => {
    const schema = itemListSchema({
      url: `${SITE_URL}/zh-Hans/sizes`,
      name: '尺寸',
      items: [
        { url: 'https://example/a', name: 'a' },
        { url: 'https://example/b', name: 'b', description: 'second' },
      ],
    })
    expect(schema.numberOfItems).toBe(2)
    const entries = schema.itemListElement as Array<Record<string, unknown>>
    expect(entries[0]?.position).toBe(1)
    expect(entries[1]?.position).toBe(2)
    expect(entries[1]?.description).toBe('second')
  })
})

describe('breadcrumbSchema', () => {
  it('emits a BreadcrumbList with absolute item URLs', () => {
    const schema = breadcrumbSchema([
      { url: `${SITE_URL}/en`, name: 'Home' },
      { url: `${SITE_URL}/en/sizes`, name: 'Sizes' },
    ])
    expect(schema['@type']).toBe('BreadcrumbList')
    const entries = schema.itemListElement as Array<Record<string, unknown>>
    expect(entries).toHaveLength(2)
    expect(entries[1]?.item).toBe(`${SITE_URL}/en/sizes`)
  })
})

describe('serializeJsonLd', () => {
  it('escapes the `</` sequence so it cannot close a script tag early', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: 'a</script>b' })
    expect(out).not.toContain('</')
    expect(out).toContain('\\u003C')
  })

  it('also neutralises HTML comment terminators', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: '--><x' })
    expect(out).not.toContain('-->')
  })
})

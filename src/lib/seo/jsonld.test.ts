import { describe, expect, it } from 'vitest'

import { breadcrumbSchema, itemListSchema, serializeJsonLd, webApplicationSchema } from './jsonld'
import { SITE_URL } from './site-config'

describe('webApplicationSchema', () => {
  it('sets the canonical URL and locale', () => {
    const schema = webApplicationSchema('en')
    expect(schema['@type']).toBe('WebApplication')
    expect(schema.url).toBe(`${SITE_URL}/en`)
    expect(schema.inLanguage).toBe('en')
    expect(schema.isAccessibleForFree).toBe(true)
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

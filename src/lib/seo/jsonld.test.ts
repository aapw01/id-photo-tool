import { describe, expect, it } from 'vitest'

import {
  blogPostingSchema,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
  organizationSchema,
  serializeJsonLd,
  webApplicationSchema,
  webPageSchema,
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

describe('organizationSchema', () => {
  it('emits a stable @id anchor under SITE_URL', () => {
    const schema = organizationSchema('en')
    expect(schema['@type']).toBe('Organization')
    expect(schema['@id']).toBe(`${SITE_URL}/#organization`)
    expect(schema.url).toBe(SITE_URL)
  })

  it('carries the brand identity fields Google requires for knowledge graph', () => {
    const schema = organizationSchema('en')
    expect(schema.name).toBe('Pixfit')
    expect(schema.alternateName).toBe('像配')
    expect(schema.logo).toMatch(/^https?:\/\/.+\/icon\.png$/)
    expect(schema.sameAs).toEqual(['https://github.com/aapw01/id-photo-tool'])
  })

  it('reflects the active locale on inLanguage so each locale shard advertises its own copy', () => {
    expect(organizationSchema('zh-Hans').inLanguage).toBe('zh-Hans')
    expect(organizationSchema('zh-Hant').inLanguage).toBe('zh-Hant')
    expect(organizationSchema('en').inLanguage).toBe('en')
  })

  it('injects the description when supplied, omits the key otherwise', () => {
    const without = organizationSchema('en')
    expect(without.description).toBeUndefined()
    const withDesc = organizationSchema('en', { description: 'Free in-browser ID photo tool.' })
    expect(withDesc.description).toBe('Free in-browser ID photo tool.')
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

describe('collectionPageSchema', () => {
  it('emits a CollectionPage anchored at the canonical URL', () => {
    const schema = collectionPageSchema({
      url: `${SITE_URL}/en/sizes`,
      name: 'All ID photo sizes',
      description: '28 specs',
      inLanguage: 'en',
    })
    expect(schema['@type']).toBe('CollectionPage')
    expect(schema.url).toBe(`${SITE_URL}/en/sizes`)
    expect(schema.description).toBe('28 specs')
    expect(schema.inLanguage).toBe('en')
    // Anchored to the WebSite node so cross-blob references stay
    // consistent — `@id` on Organization / WebSite is the stable
    // hook the rest of the JSON-LD network points back at.
    const partOf = schema.isPartOf as { '@type': string; '@id': string }
    expect(partOf['@type']).toBe('WebSite')
    expect(partOf['@id']).toBe(`${SITE_URL}/#website`)
  })

  it('embeds the ItemList as `mainEntity` so a single blob covers catalog + items', () => {
    const schema = collectionPageSchema({
      url: `${SITE_URL}/en/sizes`,
      name: 'Sizes',
      items: [
        { url: `${SITE_URL}/en/sizes/us-visa`, name: 'US visa' },
        { url: `${SITE_URL}/en/sizes/schengen`, name: 'Schengen', description: 'EU' },
      ],
    })
    const mainEntity = schema.mainEntity as {
      '@type': string
      numberOfItems: number
      itemListElement: Array<Record<string, unknown>>
    }
    expect(mainEntity['@type']).toBe('ItemList')
    expect(mainEntity.numberOfItems).toBe(2)
    expect(mainEntity.itemListElement[0]?.position).toBe(1)
    expect(mainEntity.itemListElement[1]?.description).toBe('EU')
  })

  it('skips mainEntity entirely when no items are passed', () => {
    const schema = collectionPageSchema({
      url: `${SITE_URL}/en/sizes`,
      name: 'Sizes',
    })
    expect(schema.mainEntity).toBeUndefined()
  })
})

describe('webPageSchema', () => {
  it('emits a WebPage anchored at the canonical URL', () => {
    const schema = webPageSchema({
      url: `${SITE_URL}/en/privacy`,
      name: 'Privacy policy',
      description: 'How Pixfit handles your data',
      inLanguage: 'en',
      dateModified: '2026-05-12',
    })
    expect(schema['@type']).toBe('WebPage')
    expect(schema.url).toBe(`${SITE_URL}/en/privacy`)
    expect(schema.dateModified).toBe('2026-05-12')
    expect(schema.inLanguage).toBe('en')
    expect(schema.description).toBe('How Pixfit handles your data')
  })

  it('omits optional date fields when not supplied', () => {
    const schema = webPageSchema({
      url: `${SITE_URL}/en/scanner`,
      name: 'Scanner',
    })
    expect(schema.dateModified).toBeUndefined()
    expect(schema.datePublished).toBeUndefined()
  })

  it('roots the page in the WebSite identity node for graph traversal', () => {
    const schema = webPageSchema({
      url: `${SITE_URL}/en/scanner`,
      name: 'Scanner',
    })
    const partOf = schema.isPartOf as { '@type': string; '@id': string }
    expect(partOf['@type']).toBe('WebSite')
    expect(partOf['@id']).toBe(`${SITE_URL}/#website`)
  })
})

describe('blogPostingSchema', () => {
  it('emits BlogPosting with author + publisher attributed to the org node', () => {
    const schema = blogPostingSchema({
      url: `${SITE_URL}/en/blog/us-visa-photo-2026`,
      headline: 'US visa photo 2026',
      description: 'Sizes, background, composition.',
      datePublished: '2026-05-17',
      inLanguage: 'en',
    })
    expect(schema['@type']).toBe('BlogPosting')
    expect(schema.headline).toBe('US visa photo 2026')
    expect(schema.url).toBe(`${SITE_URL}/en/blog/us-visa-photo-2026`)
    expect(schema.inLanguage).toBe('en')
    expect(schema.datePublished).toBe('2026-05-17')
    // dateModified falls back to datePublished so Google never sees a missing
    // field (a missing date can suppress the article rich result).
    expect(schema.dateModified).toBe('2026-05-17')
    const author = schema.author as { '@id': string }
    const publisher = schema.publisher as { '@id': string }
    expect(author['@id']).toBe(`${SITE_URL}/#organization`)
    expect(publisher['@id']).toBe(`${SITE_URL}/#organization`)
    const mainEntityOfPage = schema.mainEntityOfPage as { '@type': string; '@id': string }
    expect(mainEntityOfPage['@type']).toBe('WebPage')
    expect(mainEntityOfPage['@id']).toBe(`${SITE_URL}/en/blog/us-visa-photo-2026`)
  })

  it('respects an explicit dateModified when supplied', () => {
    const schema = blogPostingSchema({
      url: `${SITE_URL}/zh-Hans/blog/x`,
      headline: 'x',
      datePublished: '2026-01-10',
      dateModified: '2026-05-01',
      inLanguage: 'zh-Hans',
    })
    expect(schema.datePublished).toBe('2026-01-10')
    expect(schema.dateModified).toBe('2026-05-01')
  })

  it('serialises keyword arrays as a comma-joined string', () => {
    const schema = blogPostingSchema({
      url: `${SITE_URL}/en/blog/x`,
      headline: 'x',
      datePublished: '2026-01-10',
      inLanguage: 'en',
      keywords: ['us visa photo', '2x2 inch', 'in-browser'],
    })
    expect(schema.keywords).toBe('us visa photo, 2x2 inch, in-browser')
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

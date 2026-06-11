import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SpecDetailPage from './[specId]/page'

/**
 * Renders the /sizes/[specId] detail page to static markup and asserts
 * that the per-spec composition / format / official-source facts (added
 * to fight thin-content) actually surface in the output — they live in
 * the catalog but were previously never rendered.
 */

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (input: string | { locale: string; namespace: string }) => {
    const namespace = typeof input === 'string' ? input : input.namespace
    const fn = (key: string) => `${namespace}.${key}`
    fn.raw = () => [] as string[]
    return fn
  },
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

// Leaf / asset-heavy components are irrelevant to what we're asserting.
vi.mock('@/components/site-footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))
vi.mock('@/components/region-flag', () => ({ RegionFlag: () => null }))
vi.mock('@/components/breadcrumb', () => ({ Breadcrumb: () => null }))
vi.mock('@/components/cross-surface-links', () => ({ CrossSurfaceLinks: () => null }))
vi.mock('@/components/jsonld', () => ({ JsonLd: () => null }))

afterEach(() => {
  vi.clearAllMocks()
})

async function render(specId: string) {
  const params = Promise.resolve({ locale: 'en', specId })
  const element = await SpecDetailPage({ params })
  return renderToStaticMarkup(element)
}

describe('SpecDetailPage spec facts', () => {
  it('renders composition, format + official-source facts for us-visa', async () => {
    const html = await render('us-visa')
    // composition.headHeightRatio [0.5, 0.69] → 50%–69%
    expect(html).toContain('50%–69%')
    // composition.eyeLineFromTop [0.314, 0.441] → 31%–44%
    expect(html).toContain('31%–44%')
    // fileRules.formats ['jpg'] → JPG
    expect(html).toContain('JPG')
    // reference host, with the leading www. stripped
    expect(html).toContain('travel.state.gov')
  })

  it('omits the official-source line for specs without a reference', async () => {
    // cn-1inch has composition but no `reference` in the catalog.
    const html = await render('cn-1inch')
    expect(html).not.toContain('Official source')
  })
})

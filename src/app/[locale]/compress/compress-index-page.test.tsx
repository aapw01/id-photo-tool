import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import en from '@/i18n/messages/en.json'
import CompressIndexPage from './page'

/**
 * Renders the /compress hub to static markup using the real en.json
 * strings and asserts the SEO long-form + FAQ sections (added to bring
 * the hub up to the /scanner content depth) actually appear.
 */

function lookup(namespace: string, key: string): string {
  const path = `${namespace}.${key}`.split('.')
  let node: unknown = en
  for (const seg of path) {
    node = (node as Record<string, unknown>)?.[seg]
  }
  return typeof node === 'string' ? node : path.join('.')
}

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (input: string | { locale: string; namespace: string }) => {
    const namespace = typeof input === 'string' ? input : input.namespace
    const fn = (key: string, values?: Record<string, string | number>) => {
      const raw = lookup(namespace, key)
      return values ? raw.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`)) : raw
    }
    fn.raw = (key: string) => {
      const path = `${namespace}.${key}`.split('.')
      let node: unknown = en
      for (const seg of path) node = (node as Record<string, unknown>)?.[seg]
      return node
    }
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

vi.mock('@/components/site-footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))

afterEach(() => {
  vi.clearAllMocks()
})

/** Mirror React's text-node escaping so we can match raw i18n strings. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

describe('CompressIndexPage content depth', () => {
  it('renders the SEO intro + all five FAQ questions', async () => {
    const params = Promise.resolve({ locale: 'en' })
    const html = renderToStaticMarkup(await CompressIndexPage({ params }))

    // SEO long-form heading + both paragraphs.
    expect(html).toContain(esc(en.Compress.index.seoIntro.heading))
    expect(html).toContain(esc(en.Compress.index.seoIntro.paragraphs['0']))
    expect(html).toContain(esc(en.Compress.index.seoIntro.paragraphs['1']))

    // FAQ heading + every question.
    expect(html).toContain(esc(en.Compress.index.faq.heading))
    for (const item of Object.values(en.Compress.index.faq.items)) {
      expect(html).toContain(esc(item.q))
    }
  })
})

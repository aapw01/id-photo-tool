import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SITE_URL } from '@/lib/seo/site-config'

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => {
    return Object.assign(
      (key: string) =>
        key === 'metaDescription' ? 'Free in-browser ID photo tool · AI · no upload · 2026' : key,
      { raw: () => [] },
    )
  },
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound')
  }),
}))

vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => null,
}))

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}))

vi.mock('@/lib/fonts', () => ({
  fontSans: { variable: '--font-sans' },
  fontMono: { variable: '--font-mono' },
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('LocaleLayout — Organization JSON-LD injection', () => {
  it('renders an Organization node with the required brand identity fields', async () => {
    const { default: LocaleLayout } = await import('./layout')
    const tree = await LocaleLayout({
      children: <div>page</div>,
      params: Promise.resolve({ locale: 'en' }),
    })
    const html = renderToStaticMarkup(tree)

    // The JSON-LD blob lives in a <script type="application/ld+json">.
    // We deliberately match the serialised form (with `</` escaped to
    // `\u003C`) so a regression in the serialiser also fails this test.
    expect(html).toContain('application/ld+json')
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"name":"Pixfit"')
    expect(html).toContain('"alternateName":"像配"')
    expect(html).toContain(`"@id":"${SITE_URL}/#organization"`)
    expect(html).toContain(`"url":"${SITE_URL}"`)
    expect(html).toContain('"sameAs":["https://github.com/aapw01/id-photo-tool"]')
    expect(html).toContain(`"logo":"${SITE_URL}/icon.png"`)
    // Description sourced from `Home.metaDescription` translation.
    expect(html).toContain('Free in-browser ID photo tool')
  })

  it('localises the Organization node per request locale', async () => {
    const { default: LocaleLayout } = await import('./layout')
    const tree = await LocaleLayout({
      children: <div>page</div>,
      params: Promise.resolve({ locale: 'zh-Hans' }),
    })
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('"inLanguage":"zh-Hans"')
  })
})

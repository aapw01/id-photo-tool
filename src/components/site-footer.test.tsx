/**
 * Site-wide footer rendering guardrails.
 *
 * The footer is the only crawlable index of every public route, so a
 * regression here costs us SEO link-equity. Three properties are
 * pinned:
 *
 *   1. Every built-in `DocSpec` id from the data file appears as a
 *      `/scanner/<id>` link — if a new DocSpec is added, this test
 *      forces the footer to surface it (we import from the source
 *      data file, not a hard-coded list).
 *   2. The hand-curated top-10 popular size ids appear inside the
 *      Studio column specifically — so search engines see the
 *      strongest internal links under the workflow heading.
 *   3. Locale-aware `Link`s carry the locale prefix (mocked via
 *      `@/i18n/navigation`).
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/i18n/messages/en.json'
import { DOC_SPECS } from '@/features/scanner/lib/doc-specs'

vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}))

vi.mock('@/components/logo', () => ({
  Logo: () => <div data-testid="logo" />,
}))

/**
 * Mock the locale-aware Link to mirror what next-intl emits at
 * runtime: prefix every relative href with `/{locale}`. We also
 * collapse the `{ pathname, query }` object form into a query
 * string so the test can assert tab deep-links resolve correctly.
 */
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    prefetch,
    ...rest
  }: { href: unknown; children: React.ReactNode; prefetch?: boolean | null } & Record<
    string,
    unknown
  >) => {
    const locale = 'en'
    let resolved: string
    if (typeof href === 'string') {
      resolved = `/${locale}${href}`
    } else if (href && typeof href === 'object') {
      const obj = href as { pathname?: string; query?: Record<string, string> }
      const qs = obj.query
        ? '?' + new URLSearchParams(obj.query as Record<string, string>).toString()
        : ''
      resolved = `/${locale}${obj.pathname ?? ''}${qs}`
    } else {
      resolved = '#'
    }
    return (
      <a href={resolved} data-prefetch={prefetch === false ? 'false' : undefined} {...rest}>
        {children}
      </a>
    )
  },
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations:
    (namespace?: string) => (key: string, params?: Record<string, string | number>) => {
      const full = namespace ? `${namespace}.${key}` : key
      const parts = full.split('.')
      let cursor: unknown = enMessages
      for (const p of parts) {
        if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
          cursor = (cursor as Record<string, unknown>)[p]
        } else {
          return full
        }
      }
      let out = typeof cursor === 'string' ? cursor : full
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          out = out.replaceAll(`{${k}}`, String(v))
        }
      }
      return out
    },
}))

import { SiteFooter } from './site-footer'

const POPULAR_SPEC_IDS = [
  'us-visa',
  'schengen',
  'uk-visa',
  'jp-visa',
  'kr-visa',
  'ca-visa',
  'cn-id-card',
  'cn-1inch',
  'cn-2inch',
  'cn-passport',
]

describe('SiteFooter', () => {
  it('renders every built-in Scanner DocSpec slug as a locale-aware link', () => {
    render(<SiteFooter />)
    for (const spec of DOC_SPECS) {
      const links = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === `/en/scanner/${spec.id}`)
      expect(links.length, `DocSpec ${spec.id} missing from footer`).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders the top-10 popular photo specs inside the Studio nav column', () => {
    render(<SiteFooter />)
    const studioNav = screen.getByRole('navigation', { name: 'Studio navigation' })
    for (const id of POPULAR_SPEC_IDS) {
      const links = within(studioNav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === `/en/sizes/${id}`)
      expect(links.length, `Popular spec ${id} missing from Studio column`).toBeGreaterThanOrEqual(
        1,
      )
    }
  })

  it('prefixes every internal link with the active locale', () => {
    render(<SiteFooter />)
    const links = screen
      .getAllByRole('link')
      // Skip the GitHub absolute URL — external links don't get the
      // locale prefix.
      .filter((a) => !a.getAttribute('href')?.startsWith('http'))
    for (const a of links) {
      const href = a.getAttribute('href') ?? ''
      expect(href.startsWith('/en'), `Internal link "${href}" missing locale prefix`).toBe(true)
    }
  })

  it('uses role="contentinfo" on the footer landmark', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('declares one navigation landmark per product column', () => {
    render(<SiteFooter />)
    const navs = screen.getAllByRole('navigation')
    expect(navs).toHaveLength(4)
  })

  it('renders the four Studio workflow tab deep links', () => {
    render(<SiteFooter />)
    const studioNav = screen.getByRole('navigation', { name: 'Studio navigation' })
    for (const tab of ['background', 'size', 'layout', 'export']) {
      const found = within(studioNav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href')?.includes(`tab=${tab}`))
      expect(found.length, `Studio tab=${tab} deeplink missing`).toBeGreaterThanOrEqual(1)
    }
  })

  it('only prefetches the primary footer routes', () => {
    render(<SiteFooter />)
    const primary = ['/en/studio', '/en/scanner', '/en/sizes', '/en/paper', '/en/templates']
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? ''
      if (!href.startsWith('/en/')) continue
      expect(link.getAttribute('data-prefetch'), href).toBe(primary.includes(href) ? null : 'false')
    }
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { COMPRESS_TARGETS } from '@/features/compress/targets'
import { SUPPORTED_LOCALES } from '@/lib/seo/site-config'

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
  // CrossSurfaceLinks (rendered at the foot of the page) is a server
  // component that reads labels via the synchronous next-intl hooks.
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (input: string | { locale: string; namespace: string }) => {
    const namespace = typeof input === 'string' ? input : input.namespace
    const fn = (key: string, values?: Record<string, string | number>) => {
      const label = values?.label ? String(values.label) : ''
      return label ? `${namespace}.${key}[${label}]` : `${namespace}.${key}`
    }
    fn.raw = (key: string) => {
      if (key === 'metaKeywords') {
        return ['compress photo to {label}', 'photo compressor {label}', 'in-browser compress']
      }
      return {}
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
  Link: ({
    href,
    children,
    className,
  }: {
    href: { pathname?: string; query?: Record<string, string> } | string
    children: React.ReactNode
    className?: string
  }) => {
    const pathname = typeof href === 'string' ? href : (href.pathname ?? '#')
    const query = typeof href === 'string' ? undefined : href.query
    const search = query ? `?${new URLSearchParams(query).toString()}` : ''
    return (
      <a href={`${pathname}${search}`} className={className}>
        {children}
      </a>
    )
  },
}))

vi.mock('@/components/site-footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('CompressTargetPage', () => {
  for (const target of COMPRESS_TARGETS) {
    it(`renders the ${target.label} landing page with HowTo + FAQ + a /studio link`, async () => {
      const { default: CompressTargetPage } = await import('./[target]/page')
      const tree = await CompressTargetPage({
        params: Promise.resolve({ locale: 'en', target: target.slug }),
      })
      const html = renderToStaticMarkup(tree)

      // (a) Title carries the target label.
      expect(html).toMatch(new RegExp(`<h1[^>]*>[^<]*${target.label}`))

      // (b) HowTo + FAQ JSON-LD are present in the rendered output.
      expect(html).toContain('"@type":"HowTo"')
      expect(html).toContain('"@type":"FAQPage"')
      // The breadcrumb + WebApplication blobs ship alongside.
      expect(html).toContain('"@type":"BreadcrumbList"')
      expect(html).toContain('"@type":"WebApplication"')

      // (c) At least one link goes back to /studio.
      expect(html).toMatch(/href="\/studio/)
    })
  }

  it('rejects an unknown target slug with notFound()', async () => {
    const { default: CompressTargetPage } = await import('./[target]/page')
    await expect(
      CompressTargetPage({ params: Promise.resolve({ locale: 'en', target: 'not-a-target' }) }),
    ).rejects.toThrow('notFound')
  })

  it('generateStaticParams emits one entry per (locale, target) pair', async () => {
    const { generateStaticParams } = await import('./[target]/page')
    const params = generateStaticParams()
    // SUPPORTED_LOCALES × COMPRESS_TARGETS entries.
    expect(params).toHaveLength(SUPPORTED_LOCALES.length * COMPRESS_TARGETS.length)
    const slugs = new Set(params.map((p) => p.target))
    for (const target of COMPRESS_TARGETS) {
      expect(slugs.has(target.slug)).toBe(true)
    }
  })

  it('generateMetadata returns a title that contains the target label', async () => {
    const { generateMetadata } = await import('./[target]/page')
    for (const target of COMPRESS_TARGETS) {
      const meta = await generateMetadata({
        params: Promise.resolve({ locale: 'en', target: target.slug }),
      })
      // `buildMetadata` returns titles as `{ absolute }` by default.
      const rawTitle = meta.title
      const title =
        typeof rawTitle === 'string'
          ? rawTitle
          : typeof rawTitle === 'object' && rawTitle && 'absolute' in rawTitle
            ? String(rawTitle.absolute)
            : ''
      expect(title).toContain(target.label)
    }
  })
})

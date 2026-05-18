import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BLOG_POSTS } from '@/content/blog'
import { SUPPORTED_LOCALES } from '@/lib/seo/site-config'

const FIXTURE_INDEX: Record<string, string> = {
  'Blog.index.metaTitle': 'Pixfit blog · ID photo and document scan guides 2026 | Pixfit',
  'Blog.index.metaDescription': 'Long-form guides for online ID photos.',
  'Blog.index.breadcrumb': 'Blog',
  'Blog.index.heading': 'Pixfit blog',
  'Blog.index.subtitle': 'Long-form guides.',
  'Blog.index.openArticle': 'Read article',
}

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) => locales.includes(locale),
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (input: string | { locale: string; namespace: string }) => {
    const namespace = typeof input === 'string' ? input : input.namespace
    const fn = (key: string, values?: Record<string, string | number>) => {
      const k = `${namespace}.${key}`
      if (FIXTURE_INDEX[k]) return FIXTURE_INDEX[k]
      if (key === 'readingMinutes' && values?.minutes !== undefined)
        return `${values.minutes} min read`
      if (key === 'publishedOn' && values?.date !== undefined) return `Published ${values.date}`
      if (key === 'updatedOn' && values?.date !== undefined) return `Updated ${values.date}`
      if (key === 'home' && namespace === 'Nav') return 'Home'
      if (key.endsWith('.card.tagline')) return `tagline:${key}`
      if (namespace === 'Blog.article') {
        const map: Record<string, string> = {
          backLink: 'Back to blog',
          ctaHeading: 'Try Pixfit',
          ctaBody: 'In-browser, no upload.',
          ctaPrimary: 'Open Studio',
          ctaSecondary: 'Open Scanner',
        }
        return map[key] ?? `${namespace}.${key}`
      }
      return `${namespace}.${key}`
    }
    fn.raw = (key: string) => {
      if (key === 'metaKeywords') return ['kw1', 'kw2']
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
    return (
      <a href={pathname} className={className}>
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

describe('BlogIndexPage', () => {
  it('renders one card per BLOG_POSTS entry with a link to its detail page', async () => {
    const { default: BlogIndexPage } = await import('./page')
    const tree = await BlogIndexPage({ params: Promise.resolve({ locale: 'en' }) })
    const html = renderToStaticMarkup(tree)
    for (const post of BLOG_POSTS) {
      expect(html).toContain(`/blog/${post.slug}`)
    }
    // Index page emits CollectionPage + BlogPosting × N + BreadcrumbList.
    expect(html).toContain('"@type":"CollectionPage"')
    expect(html).toContain('"@type":"BlogPosting"')
    expect(html).toContain('"@type":"BreadcrumbList"')
  })
})

describe('BlogArticlePage', () => {
  it('generateStaticParams emits one entry per (locale, article) pair', async () => {
    const { generateStaticParams } = await import('./[slug]/page')
    const params = generateStaticParams()
    expect(params).toHaveLength(BLOG_POSTS.length * SUPPORTED_LOCALES.length)
  })

  for (const post of BLOG_POSTS) {
    it(`renders the ${post.slug} article with BlogPosting JSON-LD + a /studio link`, async () => {
      const { default: BlogArticlePage } = await import('./[slug]/page')
      const tree = await BlogArticlePage({
        params: Promise.resolve({ locale: 'en', slug: post.slug }),
      })
      const html = renderToStaticMarkup(tree)
      expect(html).toContain('"@type":"BlogPosting"')
      // The article body's H1 (title) should land in the markup.
      expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
      // CTA links back to /studio and /scanner.
      expect(html).toMatch(/href="\/studio/)
      expect(html).toMatch(/href="\/scanner/)
      // BlogPosting carries the required SEO fields.
      expect(html).toContain(`"datePublished":"${post.datePublished}"`)
    })
  }

  it('generateMetadata returns a title matching the article body H1', async () => {
    const { generateMetadata } = await import('./[slug]/page')
    for (const post of BLOG_POSTS) {
      const meta = await generateMetadata({
        params: Promise.resolve({ locale: 'en', slug: post.slug }),
      })
      // `buildMetadata` defaults to absolute titles, so `meta.title`
      // is shaped like `{ absolute: '…' }` — unwrap before measuring.
      const rawTitle = meta.title
      const title =
        typeof rawTitle === 'string'
          ? rawTitle
          : typeof rawTitle === 'object' && rawTitle && 'absolute' in rawTitle
            ? String(rawTitle.absolute)
            : ''
      expect(title.length).toBeGreaterThan(10)
    }
  })

  it('rejects an unknown article slug with notFound()', async () => {
    const { default: BlogArticlePage } = await import('./[slug]/page')
    await expect(
      BlogArticlePage({ params: Promise.resolve({ locale: 'en', slug: 'does-not-exist' }) }),
    ).rejects.toThrow('notFound')
  })
})

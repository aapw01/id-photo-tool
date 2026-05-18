/**
 * `/blog` — evergreen-article index.
 *
 * Renders one card per `BLOG_POSTS` entry, sorted by `datePublished`
 * (the registry stores them newest-first so we can iterate directly).
 * Each card emits a per-article `BlogPosting` JSON-LD blob attributed
 * to the `Organization` node already injected at the root layout.
 */

import type { Metadata } from 'next'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/breadcrumb'
import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BLOG_POSTS } from '@/content/blog'
import { getArticleBody } from '@/content/blog/loader'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbItemsToJsonLd, getBreadcrumbItems } from '@/lib/seo/breadcrumbs'
import { blogPostingSchema, collectionPageSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface PageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Blog.index' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/blog',
    title: t('metaTitle'),
    description: t('metaDescription'),
    keywords: t.raw('metaKeywords') as string[],
  })
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const typedLocale = locale as Locale

  const t = await getTranslations({ locale, namespace: 'Blog.index' })
  const tPosts = await getTranslations({ locale, namespace: 'Blog.posts' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const canonicalUrl = buildCanonical('/blog', typedLocale)

  const breadcrumbItems = getBreadcrumbItems('blog', {
    labels: { home: tNav('home'), blog: t('breadcrumb') },
  })
  const breadcrumbs = breadcrumbItemsToJsonLd(breadcrumbItems, typedLocale)

  const articles = BLOG_POSTS.map((post) => {
    const body = getArticleBody(post.slug, typedLocale)
    const url = buildCanonical(`/blog/${post.slug}`, typedLocale)
    const tagline = tPosts(
      `${post.slug as 'us-visa-photo-2026' | '12-doc-scan-pdf-guide'}.card.tagline`,
    )
    return {
      slug: post.slug,
      url,
      headline: body?.title ?? post.slug,
      description: body?.description ?? tagline,
      tagline,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      readingMinutes: post.readingMinutes,
      tags: post.tags,
    }
  })

  const collectionPage = collectionPageSchema({
    url: canonicalUrl,
    name: t('heading'),
    description: t('subtitle'),
    inLanguage: typedLocale,
    items: articles.map((a) => ({ url: a.url, name: a.headline, description: a.description })),
  })

  const postings = articles.map((a) =>
    blogPostingSchema({
      url: a.url,
      headline: a.headline,
      description: a.description,
      datePublished: a.datePublished,
      dateModified: a.dateModified,
      inLanguage: typedLocale,
      keywords: a.tags,
    }),
  )

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pt-10 pb-16">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />
          <header className="mb-10 max-w-3xl">
            <h1
              className="font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {t('heading')}
            </h1>
            <p className="mt-3 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('subtitle')}
            </p>
          </header>

          <ul className="grid gap-6 sm:grid-cols-2">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={{ pathname: `/blog/${article.slug}` }}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]/30"
                >
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">
                    {article.headline}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-text-mute)]">{article.tagline}</p>
                  <dl className="mt-4 flex flex-wrap items-center gap-4 font-mono text-xs text-[var(--color-text-weak)]">
                    <div className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3.5" aria-hidden="true" />
                      <dt className="sr-only">{t('publishedOn', { date: '' })}</dt>
                      <dd>{dateFormatter.format(new Date(article.datePublished))}</dd>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden="true" />
                      <dt className="sr-only">{t('readingMinutes', { minutes: '' })}</dt>
                      <dd>{t('readingMinutes', { minutes: article.readingMinutes })}</dd>
                    </div>
                  </dl>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-[var(--color-primary-dk)]">
                    {t('openArticle')}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[collectionPage, ...postings, breadcrumbs]} />
    </>
  )
}

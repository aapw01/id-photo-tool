/**
 * `/blog/[slug]` — long-form article detail.
 *
 * Articles are stored as structured `ArticleBody` objects under
 * `src/content/blog/<slug>/<locale>.ts`. This page resolves the body
 * via the static loader (no runtime fetch, no MDX runtime), renders
 * the sections semantically, and emits a `BlogPosting` JSON-LD blob
 * attributed to the Pixfit `Organization` node.
 */

import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/breadcrumb'
import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BLOG_POSTS, getBlogPost } from '@/content/blog'
import { getArticleBody } from '@/content/blog/loader'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbItemsToJsonLd, getBreadcrumbItems } from '@/lib/seo/breadcrumbs'
import { blogPostingSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * Lock the route to the predefined (locale × slug) matrix.
 * See `src/app/[locale]/sizes/[specId]/page.tsx` for the rationale.
 */
export const dynamicParams = false

export function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = []
  for (const locale of routing.locales) {
    for (const post of BLOG_POSTS) {
      params.push({ locale, slug: post.slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const post = getBlogPost(slug)
  if (!post) return {}
  const body = getArticleBody(slug, locale as Locale)
  if (!body) return {}
  return buildMetadata({
    locale: locale as Locale,
    path: `/blog/${slug}`,
    title: body.title,
    description: body.description,
    keywords: post.tags,
  })
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const post = getBlogPost(slug)
  if (!post) notFound()
  const typedLocale = locale as Locale
  const body = getArticleBody(slug, typedLocale)
  if (!body) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Blog.article' })
  const tBlog = await getTranslations({ locale, namespace: 'Blog.index' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const canonicalUrl = buildCanonical(`/blog/${slug}`, typedLocale)
  const publishedLabel = dateFormatter.format(new Date(post.datePublished))
  const modifiedLabel = post.dateModified ? dateFormatter.format(new Date(post.dateModified)) : null

  const breadcrumbItems = getBreadcrumbItems('blog-detail', {
    labels: { home: tNav('home'), blog: tBlog('breadcrumb') },
    detail: { itemName: body.title, itemSlug: slug },
  })
  const breadcrumbs = breadcrumbItemsToJsonLd(breadcrumbItems, typedLocale)

  const posting = blogPostingSchema({
    url: canonicalUrl,
    headline: body.title,
    description: body.description,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    inLanguage: typedLocale,
    keywords: post.tags,
  })

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 pt-10 pb-16">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />

          <nav className="mb-6">
            <Link
              href={{ pathname: '/blog' }}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('backLink')}
            </Link>
          </nav>

          <header className="mb-10">
            <h1
              className="font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-3)',
                lineHeight: 'var(--text-display-3--line-height)',
              }}
            >
              {body.title}
            </h1>
            <p className="mt-3 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {body.description}
            </p>
            <dl className="mt-4 flex flex-wrap items-center gap-4 font-mono text-xs text-[var(--color-text-weak)]">
              <div className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" aria-hidden="true" />
                <dt className="sr-only">{t('publishedOn', { date: '' })}</dt>
                <dd>{t('publishedOn', { date: publishedLabel })}</dd>
              </div>
              {modifiedLabel ? (
                <div className="inline-flex items-center gap-1.5">
                  <dt className="sr-only">{t('updatedOn', { date: '' })}</dt>
                  <dd>{t('updatedOn', { date: modifiedLabel })}</dd>
                </div>
              ) : null}
              <div className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                <dt className="sr-only">{t('readingMinutes', { minutes: '' })}</dt>
                <dd>{t('readingMinutes', { minutes: post.readingMinutes })}</dd>
              </div>
            </dl>
          </header>

          <div className="space-y-12">
            {body.sections.map((section, sIdx) => (
              <section key={sIdx} aria-labelledby={`section-${sIdx}`} className="space-y-4">
                <h2
                  id={`section-${sIdx}`}
                  className="text-[var(--color-text)]"
                  style={{ fontSize: 'var(--text-h2)', lineHeight: 'var(--text-h2--line-height)' }}
                >
                  {section.heading}
                </h2>
                {section.intro ? (
                  <p className="text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
                    {section.intro}
                  </p>
                ) : null}
                {section.blocks.map((block, bIdx) => {
                  if (block.type === 'p') {
                    return (
                      <p
                        key={bIdx}
                        className="leading-relaxed text-[var(--color-text)] text-[var(--text-body)]"
                      >
                        {block.text}
                      </p>
                    )
                  }
                  const ListTag = block.ordered ? 'ol' : 'ul'
                  return (
                    <ListTag
                      key={bIdx}
                      className={`${
                        block.ordered ? 'list-decimal' : 'list-disc'
                      } space-y-2 pl-6 leading-relaxed text-[var(--color-text)] text-[var(--text-body)] marker:text-[var(--color-text-weak)]`}
                    >
                      {block.items.map((item, iIdx) => (
                        <li key={iIdx}>{item}</li>
                      ))}
                    </ListTag>
                  )
                })}
              </section>
            ))}

            {body.closing ? (
              <p className="leading-relaxed text-[var(--color-text)] text-[var(--text-body)]">
                {body.closing}
              </p>
            ) : null}
          </div>

          <section className="mt-12 rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/40 p-6">
            <h2
              className="text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('ctaHeading')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-mute)]">{t('ctaBody')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={{ pathname: '/studio' }}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
              >
                {t('ctaPrimary')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={{ pathname: '/scanner' }}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
              >
                {t('ctaSecondary')}
              </Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={[posting, breadcrumbs]} />
    </>
  )
}

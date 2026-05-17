/**
 * `/compress` — landing hub that funnels search traffic for
 * "compress photo to {N}KB" queries into the per-target pages and,
 * for power users, into Studio's Export tab.
 */

import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/breadcrumb'
import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { COMPRESS_TARGETS } from '@/features/compress/targets'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbItemsToJsonLd, getBreadcrumbItems } from '@/lib/seo/breadcrumbs'
import { collectionPageSchema, webApplicationSchema } from '@/lib/seo/jsonld'
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
  const t = await getTranslations({ locale, namespace: 'Compress.index' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/compress',
    title: t('metaTitle'),
    description: t('metaDescription'),
    keywords: t.raw('metaKeywords') as string[],
  })
}

export default async function CompressIndexPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Compress.index' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const canonicalUrl = buildCanonical('/compress', locale as Locale)

  const breadcrumbItems = getBreadcrumbItems('compress', {
    labels: { home: tNav('home'), compress: t('heading') },
  })
  const breadcrumbs = breadcrumbItemsToJsonLd(breadcrumbItems, locale as Locale)

  const collectionPage = collectionPageSchema({
    url: canonicalUrl,
    name: t('heading'),
    description: t('subtitle'),
    inLanguage: locale as Locale,
    items: COMPRESS_TARGETS.map((target) => ({
      url: buildCanonical(`/compress/${target.slug}`, locale as Locale),
      name: t('targets.cardCta', { label: target.label }),
    })),
  })

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
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-mute)]">
              {t('intro')}
            </p>
          </header>

          <section aria-labelledby="compress-targets-heading">
            <h2
              id="compress-targets-heading"
              className="mb-4 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h2)', lineHeight: 'var(--text-h2--line-height)' }}
            >
              {t('targets.heading')}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COMPRESS_TARGETS.map((target) => (
                <li key={target.slug}>
                  <Link
                    href={{ pathname: `/compress/${target.slug}` }}
                    className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]/30"
                  >
                    <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
                      {target.slug}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                      {target.label}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-mute)]">
                      {t('targets.cardSubtitle', { label: target.label })}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-[var(--color-primary-dk)]">
                      {t('targets.cardCta', { label: target.label })}
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

          <section
            className="mt-12 rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/40 p-6"
            aria-labelledby="compress-studio-heading"
          >
            <h2
              id="compress-studio-heading"
              className="text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('studio.heading')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-mute)]">{t('studio.body')}</p>
            <Link
              href={{ pathname: '/studio', query: { tab: 'export' } }}
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
            >
              {t('studio.cta')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), collectionPage, breadcrumbs]} />
    </>
  )
}

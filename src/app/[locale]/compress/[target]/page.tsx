/**
 * `/compress/[target]` — per-target compression landing page.
 *
 * One page per supported target (50KB / 100KB / 200KB / 500KB /
 * 1MB), each targeting a high-intent long-tail search like
 * "compress photo to 50kb online". The page:
 *
 *   - states the exact target up front + a free / in-browser /
 *     no-upload claim
 *   - emits a 4-step `HowTo` JSON-LD plus a visible step list
 *   - emits a `FAQPage` JSON-LD plus a visible accordion
 *   - links back to `/studio?tab=export&compress={slug}` for the
 *     full power user surface
 *   - inherits the global Organization JSON-LD from the locale
 *     layout, and emits its own `WebApplication` + `HowTo` +
 *     `FAQPage` + `BreadcrumbList`
 */

import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/breadcrumb'
import { CrossSurfaceLinks } from '@/components/cross-surface-links'
import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { COMPRESS_TARGETS, findCompressTarget } from '@/features/compress/targets'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbItemsToJsonLd, getBreadcrumbItems } from '@/lib/seo/breadcrumbs'
import { faqSchema, howToSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { INDEX_LOCALES, isIndexedLocale } from '@/lib/seo/site-config'

interface PageProps {
  params: Promise<{ locale: string; target: string }>
}

const HOWTO_STEP_KEYS = ['upload', 'target', 'compress', 'download'] as const
const FAQ_ITEM_KEYS = ['quality', 'target', 'format', 'batch'] as const

/**
 * Lock the route to the predefined (locale × target) matrix.
 * See `src/app/[locale]/sizes/[specId]/page.tsx` for the rationale.
 */
export const dynamicParams = false

export function generateStaticParams() {
  const params: Array<{ locale: string; target: string }> = []
  for (const locale of routing.locales) {
    for (const target of COMPRESS_TARGETS) {
      params.push({ locale, target: target.slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, target: targetSlug } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const target = findCompressTarget(targetSlug)
  if (!target) return {}
  const t = await getTranslations({ locale, namespace: 'Compress.detail' })
  // Raw keyword strings reach `keywords` un-interpolated; interpolate
  // them here so {label} reads correctly in the SERP keyword cluster.
  const rawKeywords = t.raw('metaKeywords') as string[]
  const keywords = rawKeywords.map((k) => k.replace(/\{label\}/g, target.label))
  return buildMetadata({
    locale: locale as Locale,
    path: `/compress/${target.slug}`,
    title: t('metaTitle', { label: target.label }),
    description: t('metaDescription', { label: target.label }),
    keywords,
    // See INDEX_LOCALES — detail tier indexed in zh-Hans + en only.
    noIndex: !isIndexedLocale(locale as Locale),
    alternateLocales: INDEX_LOCALES,
  })
}

export default async function CompressTargetPage({ params }: PageProps) {
  const { locale, target: targetSlug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const target = findCompressTarget(targetSlug)
  if (!target) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Compress.detail' })
  const tIndex = await getTranslations({ locale, namespace: 'Compress.index' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const label = target.label

  const breadcrumbItems = getBreadcrumbItems('compress-detail', {
    labels: { home: tNav('home'), compress: tIndex('heading') },
    detail: { itemName: label, itemSlug: target.slug },
  })
  const breadcrumbs = breadcrumbItemsToJsonLd(breadcrumbItems, locale as Locale)

  const howToSteps = HOWTO_STEP_KEYS.map((key) => ({
    name: t(`howTo.steps.${key}.name`, { label }),
    text: t(`howTo.steps.${key}.text`, { label }),
  }))
  const howTo = howToSchema({
    name: t('howTo.title', { label }),
    description: t('howTo.subtitle'),
    totalTimeISO: t('howTo.totalTimeIso'),
    steps: howToSteps,
  })

  const faqEntries = FAQ_ITEM_KEYS.map((key) => ({
    question: t(`faq.items.${key}.q`, { label }),
    answer: t(`faq.items.${key}.a`, { label }),
  }))
  const faq = faqSchema(faqEntries)

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-4xl px-6 pt-10 pb-16">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />

          <nav className="mb-6">
            <Link
              href={{ pathname: '/compress' }}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('backLink')}
            </Link>
          </nav>

          <header className="mb-10">
            <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
              {target.slug}
            </p>
            <h1
              className="mt-3 font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {t('heading', { label })}
            </h1>
            <p className="mt-3 font-mono text-sm text-[var(--color-text-weak)]">
              {t('tagline', { label })}
            </p>
            <p className="mt-5 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('intro', { label })}
            </p>
          </header>

          <section className="mb-12" aria-labelledby="compress-howto">
            <h2
              id="compress-howto"
              className="mb-2 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('howTo.title', { label })}
            </h2>
            <p className="mb-6 text-sm text-[var(--color-text-mute)]">{t('howTo.subtitle')}</p>
            <ol className="space-y-4">
              {howToSteps.map((step, idx) => (
                <li
                  key={HOWTO_STEP_KEYS[idx]}
                  className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-mono text-sm font-semibold text-[var(--color-primary-dk)]">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text)]">{step.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-mute)]">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-12" aria-labelledby="compress-faq">
            <h2
              id="compress-faq"
              className="mb-4 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('faq.title', { label })}
            </h2>
            <div className="space-y-3">
              {faqEntries.map((entry, idx) => (
                <details
                  key={FAQ_ITEM_KEYS[idx]}
                  className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 open:shadow-[var(--shadow-sm)]"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-[var(--color-text)] marker:hidden">
                    {entry.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-mute)]">
                    {entry.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)] p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 font-medium text-[var(--color-primary-dk)]">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={{
                    pathname: '/studio',
                    query: { tab: 'export', compress: target.slug },
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
                >
                  {t('cta.primary', { label })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href={{ pathname: '/studio' }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
                >
                  {t('cta.secondary')}
                </Link>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-mute)]">{t('cta.secondaryHint')}</p>
          </section>

          <CrossSurfaceLinks current="compress" />
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), breadcrumbs, howTo, faq]} />
    </>
  )
}

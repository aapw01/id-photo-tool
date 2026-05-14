/**
 * Scanner DocType detail page — one per built-in DocSpec.
 *
 * Each page is statically generated at build time (`generateStaticParams`)
 * and SSR'd at request time; the workspace shell itself is *not*
 * mounted here — these pages are intentionally crawl-friendly content
 * landing pages that funnel users into `/scanner` with the right
 * DocSpec preselected via the `spec` query param.
 *
 * SEO surface:
 *   - `<title>` + meta description per DocType × locale
 *   - hreflang × canonical wired through `buildMetadata`
 *   - JSON-LD: WebApplication + BreadcrumbList + HowTo + FAQPage
 *   - H2 sections: summary / usage / spec / how-to / FAQ
 */

import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { DOC_SPECS, getOutputPixels, type DocSpec } from '@/features/scanner/lib/doc-specs'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbSchema, faqSchema, howToSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface PageProps {
  params: Promise<{ locale: string; docType: string }>
}

const HOWTO_STEP_KEYS = ['upload', 'detect', 'configure', 'export'] as const
const FAQ_ITEM_KEYS = ['free', 'privacy', 'watermark', 'official'] as const

function findDocSpec(id: string): DocSpec | null {
  return DOC_SPECS.find((s) => s.id === id) ?? null
}

export function generateStaticParams() {
  const params: Array<{ locale: string; docType: string }> = []
  for (const locale of routing.locales) {
    for (const spec of DOC_SPECS) {
      params.push({ locale, docType: spec.id })
    }
  }
  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, docType } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const spec = findDocSpec(docType)
  if (!spec) return {}
  const t = await getTranslations({ locale, namespace: 'Scanner.detail' })
  const tName = await getTranslations({ locale, namespace: 'Scanner.docSpecs' })
  const tScanner = await getTranslations({ locale, namespace: 'Scanner' })
  const name = tName(spec.id as Parameters<typeof tName>[0])
  // Per-DocType pages inherit the parent /scanner intent cluster so
  // long-tail queries like "中国身份证扫描" still attribute to the AI
  // scanner brand keywords, then prepend the doc name to anchor the
  // page-specific tail.
  const baseKeywords = tScanner.raw('metaKeywords') as string[]
  const keywords = [name, ...baseKeywords]
  return buildMetadata({
    locale: locale as Locale,
    path: `/scanner/${spec.id}`,
    title: t('metaTitle', { name }),
    description: t('metaDescription', { name }),
    keywords,
  })
}

export default async function ScannerDocTypePage({ params }: PageProps) {
  const { locale, docType } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const spec = findDocSpec(docType)
  if (!spec) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Scanner.detail' })
  const tDocTypes = await getTranslations({ locale, namespace: 'Scanner.docTypes' })
  const tNames = await getTranslations({ locale, namespace: 'Scanner.docSpecs' })
  const tGroups = await getTranslations({ locale, namespace: 'Scanner.docSpecGroups' })
  const tScanner = await getTranslations({ locale, namespace: 'Scanner' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const name = tNames(spec.id as Parameters<typeof tNames>[0])
  const groupLabel = tGroups(spec.group as Parameters<typeof tGroups>[0])
  const summary = tDocTypes(`${spec.id}.summary` as Parameters<typeof tDocTypes>[0])
  const usage = tDocTypes(`${spec.id}.usage` as Parameters<typeof tDocTypes>[0])
  const { width: widthPx, height: heightPx } = getOutputPixels(spec)

  const canonicalUrl = buildCanonical(`/scanner/${spec.id}`, locale as Locale)
  const scannerUrl = buildCanonical('/scanner', locale as Locale)

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('home') },
    { url: scannerUrl, name: tScanner('title') },
    { url: canonicalUrl, name },
  ])

  const howToSteps = HOWTO_STEP_KEYS.map((key) => ({
    name: t(`howTo.steps.${key}.name`, { name }),
    text: t(`howTo.steps.${key}.text`, { name }),
  }))

  const howTo = howToSchema({
    name: t('howTo.title', { name }),
    description: t('howTo.subtitle'),
    totalTimeISO: t('howTo.totalTimeIso'),
    steps: howToSteps,
  })

  const faqEntries = FAQ_ITEM_KEYS.map((key) => ({
    question: t(`faq.items.${key}.q`, { name }),
    answer: t(`faq.items.${key}.a`, { name }),
  }))
  const faq = faqSchema(faqEntries)

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-4xl px-6 pt-10 pb-16">
          <nav className="mb-6">
            <Link
              href={{ pathname: '/scanner' }}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('backLink')}
            </Link>
          </nav>

          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] text-[var(--color-primary-dk)] uppercase">
                {groupLabel}
              </span>
              <span className="font-mono text-xs tracking-[0.25em] text-[var(--color-text-weak)] uppercase">
                {spec.id}
              </span>
            </div>
            <h1
              className="mt-3 font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {name}
            </h1>
            <p className="mt-3 font-mono text-sm text-[var(--color-text-weak)]">
              {t('tagline', { w: spec.widthMm, h: spec.heightMm })}
            </p>
            <p className="mt-5 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {summary}
            </p>
          </header>

          <section className="mb-12" aria-labelledby="scanner-doc-summary">
            <h2
              id="scanner-doc-summary"
              className="mb-3 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('summarySection.title', { name })}
            </h2>
            <p className="mb-2 text-sm text-[var(--color-text-weak)]">
              {t('summarySection.subtitle')}
            </p>
            <p className="leading-relaxed text-[var(--color-text-mute)]">{usage}</p>
          </section>

          <section
            className="mb-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            aria-labelledby="scanner-doc-spec"
          >
            <h2
              id="scanner-doc-spec"
              className="mb-4 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('specSection.title')}
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">
                  {t('specSection.dimensions')}
                </dt>
                <dd className="mt-1 text-[var(--color-text)]">
                  {spec.widthMm} × {spec.heightMm} mm
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">{t('specSection.pixels')}</dt>
                <dd className="mt-1 font-mono text-[var(--color-text)]">
                  {widthPx} × {heightPx} px
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">
                  {t('specSection.twoSided')}
                </dt>
                <dd className="mt-1 text-[var(--color-text)]">
                  {spec.hasBack ? t('specSection.twoSidedYes') : t('specSection.twoSidedNo')}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mb-12" aria-labelledby="scanner-doc-howto">
            <h2
              id="scanner-doc-howto"
              className="mb-2 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('howTo.title', { name })}
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

          <section className="mb-12" aria-labelledby="scanner-doc-faq">
            <h2
              id="scanner-doc-faq"
              className="mb-4 text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--text-h3--line-height)' }}
            >
              {t('faq.title', { name })}
            </h2>
            <div className="space-y-4">
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
                {name}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={{
                    pathname: '/scanner',
                    query: { spec: spec.id },
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
                >
                  {t('cta.primary', { name })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href={{ pathname: '/scanner' }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
                >
                  {t('cta.secondary')}
                </Link>
              </div>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), breadcrumbs, howTo, faq]} />
    </>
  )
}

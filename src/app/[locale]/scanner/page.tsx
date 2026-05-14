import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ScannerShellLazy } from '@/features/scanner/components/scanner-shell-lazy'
import { DOC_SPECS, groupDocSpecs } from '@/features/scanner/lib/doc-specs'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { faqSchema, itemListSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface ScannerPageProps {
  params: Promise<{ locale: string }>
}

const FAQ_ITEM_KEYS = ['free', 'privacy', 'watermark', 'official', 'accuracy'] as const
const USAGE_KEYS = ['local', 'watermark', 'lawful', 'accuracy'] as const

export async function generateMetadata({ params }: ScannerPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Scanner' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/scanner',
    title: t('title'),
    description: t('metaDescription'),
  })
}

export default async function ScannerPage({ params }: ScannerPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('Scanner')
  const tDoc = await getTranslations('Scanner.docSpecs')
  const tGroup = await getTranslations('Scanner.docSpecGroups')
  const tDocTypes = await getTranslations('Scanner.docTypes')
  const tSupported = await getTranslations('Scanner.supported')
  const tFaq = await getTranslations('Scanner.faq')
  const tUsage = await getTranslations('Scanner.usage')

  const groups = groupDocSpecs()

  const faqEntries = FAQ_ITEM_KEYS.map((key) => ({
    question: tFaq(`items.${key}.q` as Parameters<typeof tFaq>[0]),
    answer: tFaq(`items.${key}.a` as Parameters<typeof tFaq>[0]),
  }))
  const faqJsonLd = faqSchema(faqEntries)

  const supportedListJsonLd = itemListSchema({
    url: buildCanonical('/scanner', locale as Locale),
    name: tSupported('heading'),
    description: tSupported('subtitle'),
    items: DOC_SPECS.map((spec) => ({
      url: buildCanonical(`/scanner/${spec.id}`, locale as Locale),
      name: tDoc(spec.id as Parameters<typeof tDoc>[0]),
      description: tDocTypes(`${spec.id}.summary` as Parameters<typeof tDocTypes>[0]),
    })),
  })

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-16">
          <header className="mb-8">
            <h1
              className="font-semibold tracking-tight text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-3)',
                lineHeight: 'var(--text-display-3--line-height)',
              }}
            >
              {t('title')}
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('subtitle')}
            </p>
          </header>

          {/* See `scanner-shell-lazy.tsx` for why this is mounted via
              `dynamic({ ssr: false })` — same rationale as Studio. */}
          <Suspense fallback={null}>
            <ScannerShellLazy />
          </Suspense>
        </section>

        {/* SSR-rendered SEO intro — visible to crawlers without
            executing the workspace. Keeps `/scanner` a real content
            page from day one, before any feature lands. */}
        <section className="mx-auto max-w-4xl px-6 pb-16" aria-labelledby="scanner-seo-intro">
          <h2
            id="scanner-seo-intro"
            className="mb-4 text-[var(--color-text)]"
            style={{
              fontSize: 'var(--text-h2)',
              lineHeight: 'var(--text-h2--line-height)',
            }}
          >
            {t('seoIntro.heading')}
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-mute)]">
            <p>{t('seoIntro.paragraphs.0')}</p>
            <p>{t('seoIntro.paragraphs.1')}</p>
          </div>
        </section>

        {/* Supported DocType card grid — one card per built-in spec,
            linking out to the per-DocType SEO landing page. Cards are
            grouped (id-card / driver-license / vehicle-license /
            passport / paper) so the catalog reads in a meaningful
            order rather than alphabetical. */}
        <section
          className="mx-auto max-w-6xl px-6 pb-16"
          aria-labelledby="scanner-supported-doc-types"
        >
          <header className="mb-8">
            <h2
              id="scanner-supported-doc-types"
              className="text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h2)',
                lineHeight: 'var(--text-h2--line-height)',
              }}
            >
              {tSupported('heading')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-mute)]">
              {tSupported('subtitle')}
            </p>
          </header>

          <div className="space-y-10">
            {groups.map(({ group, specs }) => (
              <div key={group}>
                <h3 className="mb-4 inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
                  {tGroup(group as Parameters<typeof tGroup>[0])}
                </h3>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {specs.map((spec) => (
                    <li key={spec.id}>
                      <Link
                        href={`/scanner/${spec.id}`}
                        className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary-dk)]">
                            {tDoc(spec.id as Parameters<typeof tDoc>[0])}
                          </h4>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--color-text-weak)]">
                            {tSupported('dimensionTagline', { w: spec.widthMm, h: spec.heightMm })}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--color-text-mute)]">
                          {tDocTypes(`${spec.id}.summary` as Parameters<typeof tDocTypes>[0])}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-dk)]">
                          {tSupported('cardCta')}
                          <ArrowRight
                            className="size-3.5 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Scanner-scoped FAQ — re-using the FAQPage JSON-LD pattern
            from the home page and `/sizes/[specId]`. Helps both
            featured snippets and answers user objections about
            uploads / watermarks before they hit the workspace. */}
        <section className="mx-auto max-w-4xl px-6 pb-20" aria-labelledby="scanner-faq">
          <header className="mb-8">
            <h2
              id="scanner-faq"
              className="text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h2)',
                lineHeight: 'var(--text-h2--line-height)',
              }}
            >
              {tFaq('heading')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-mute)]">{tFaq('subtitle')}</p>
          </header>
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

        {/* Mandatory usage notice — collapsed by default to keep the
            page scannable, but always visible to the user before they
            export their first scan. Re-asserts the local-only / watermark
            / lawful-use posture from PRD §7 + the legal warning baked
            into S5. */}
        <section className="mx-auto max-w-4xl px-6 pb-20" aria-labelledby="scanner-usage-notice">
          <details className="group rounded-[var(--radius-lg)] border border-[var(--color-warning-soft,var(--color-primary-soft))] bg-[var(--color-surface)] p-5 open:shadow-[var(--shadow-sm)]">
            <summary className="flex cursor-pointer list-none items-start gap-3 marker:hidden">
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-[var(--color-primary-dk)]"
              />
              <div className="flex-1">
                <h2
                  id="scanner-usage-notice"
                  className="text-base font-semibold text-[var(--color-text)]"
                >
                  {tUsage('heading')}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-mute)]">{tUsage('summary')}</p>
              </div>
            </summary>
            <ul className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
              {USAGE_KEYS.map((key) => (
                <li key={key}>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {tUsage(`items.${key}.title` as Parameters<typeof tUsage>[0])}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-mute)]">
                    {tUsage(`items.${key}.body` as Parameters<typeof tUsage>[0])}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-[var(--color-text-mute)]">
              <Link
                href={{ pathname: '/terms' }}
                className="font-medium text-[var(--color-primary-dk)] underline-offset-2 hover:underline"
              >
                {tUsage('termsLink')}
              </Link>
            </p>
          </details>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), supportedListJsonLd, faqJsonLd]} />
    </>
  )
}

import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BUILTIN_PAPER_SPECS } from '@/data/paper-specs'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import { breadcrumbSchema, itemListSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface PaperPageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Paper.list' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/paper',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

export default async function PaperPage({ params }: PaperPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Paper.list' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const canonicalUrl = buildCanonical('/paper', locale as Locale)

  const itemList = itemListSchema({
    url: canonicalUrl,
    name: t('heading'),
    description: t('subtitle'),
    items: BUILTIN_PAPER_SPECS.map((paper) => ({
      url: `${canonicalUrl}#${paper.id}`,
      name: localizeText(paper.name, locale),
    })),
  })

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('home') },
    { url: canonicalUrl, name: t('heading') },
  ])

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-16">
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

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BUILTIN_PAPER_SPECS.map((paper) => {
              const name = localizeText(paper.name, locale)
              return (
                <li
                  key={paper.id}
                  id={paper.id}
                  className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
                >
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text)]">{name}</h3>
                    <p className="mt-0.5 font-mono text-xs text-[var(--color-text-weak)]">
                      {paper.id}
                    </p>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {paper.alias ? (
                      <div>
                        <dt className="text-xs text-[var(--color-text-weak)]">
                          {t('fields.alias')}
                        </dt>
                        <dd className="text-[var(--color-text)]">{paper.alias}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-xs text-[var(--color-text-weak)]">
                        {t('fields.dimensions')}
                      </dt>
                      <dd className="text-[var(--color-text)]">
                        {paper.width_mm} × {paper.height_mm} mm
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-weak)]">
                        {t('fields.pixels')}
                      </dt>
                      <dd className="font-mono text-[var(--color-text)]">
                        {paper.width_px ?? '—'} × {paper.height_px ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-weak)]">{t('fields.dpi')}</dt>
                      <dd className="font-mono text-[var(--color-text)]">{paper.dpi}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto pt-4">
                    <Link
                      href={{
                        pathname: '/studio',
                        query: { tab: 'layout', paper: paper.id },
                      }}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
                    >
                      {t('cta')}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), itemList, breadcrumbs]} />
    </>
  )
}

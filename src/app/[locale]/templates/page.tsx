import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BUILTIN_LAYOUT_TEMPLATES } from '@/data/layout-templates'
import { getPaperSpec } from '@/data/paper-specs'
import { getPhotoSpec } from '@/data/photo-specs'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import { breadcrumbSchema, itemListSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface TemplatesPageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: TemplatesPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Templates' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/templates',
    title: t('metaTitle'),
    description: t('metaDescription'),
    keywords: t.raw('metaKeywords') as string[],
  })
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Templates' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const canonicalUrl = buildCanonical('/templates', locale as Locale)

  const itemList = itemListSchema({
    url: canonicalUrl,
    name: t('heading'),
    description: t('subtitle'),
    items: BUILTIN_LAYOUT_TEMPLATES.map((tmpl) => ({
      url: `${canonicalUrl}#${tmpl.id}`,
      name: localizeText(tmpl.name, locale),
    })),
  })

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('home') },
    { url: canonicalUrl, name: t('heading') },
  ])

  const groupedByPaper = new Map<string, typeof BUILTIN_LAYOUT_TEMPLATES>()
  for (const tmpl of BUILTIN_LAYOUT_TEMPLATES) {
    const bucket = groupedByPaper.get(tmpl.paperId)
    if (bucket) bucket.push(tmpl)
    else groupedByPaper.set(tmpl.paperId, [tmpl])
  }

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

          <div className="space-y-12">
            {Array.from(groupedByPaper.entries()).map(([paperId, items]) => {
              const paper = getPaperSpec(paperId)
              const paperName = paper ? localizeText(paper.name, locale) : paperId
              return (
                <section key={paperId} aria-labelledby={`paper-${paperId}`}>
                  <h2
                    id={`paper-${paperId}`}
                    className="mb-4 text-[var(--color-text)]"
                    style={{
                      fontSize: 'var(--text-h2)',
                      lineHeight: 'var(--text-h2--line-height)',
                    }}
                  >
                    {paperName}
                  </h2>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((tmpl) => {
                      const total = tmpl.items.reduce((acc, it) => acc + it.count, 0)
                      const name = localizeText(tmpl.name, locale)
                      return (
                        <li
                          key={tmpl.id}
                          id={tmpl.id}
                          className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
                        >
                          <div>
                            <h3 className="text-base font-semibold text-[var(--color-text)]">
                              {name}
                            </h3>
                            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-weak)]">
                              {tmpl.id}
                            </p>
                          </div>
                          <p className="mt-3 text-sm text-[var(--color-text-mute)]">
                            {t('fields.total', { count: total })}
                          </p>
                          <ul className="mt-3 space-y-1 text-sm text-[var(--color-text)]">
                            {tmpl.items.map((item) => {
                              const photo = getPhotoSpec(item.photoSpecId)
                              const photoName = photo
                                ? localizeText(photo.name, locale)
                                : item.photoSpecId
                              return (
                                <li
                                  key={item.photoSpecId}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span>{photoName}</span>
                                  <span className="font-mono text-xs text-[var(--color-text-weak)]">
                                    × {item.count}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                          <div className="mt-auto pt-4">
                            <Link
                              href={{
                                pathname: '/studio',
                                query: { tab: 'layout', template: tmpl.id },
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
              )
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), itemList, breadcrumbs]} />
    </>
  )
}

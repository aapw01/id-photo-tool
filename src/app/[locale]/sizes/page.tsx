import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { RegionFlag } from '@/components/region-flag'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { groupPhotoSpecsByCategory } from '@/features/seo/group-photo-specs'
import { flagCodeForRegion } from '@/features/seo/spec-region'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import { breadcrumbSchema, itemListSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface SizesPageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: SizesPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Sizes' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/sizes',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

export default async function SizesPage({ params }: SizesPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Sizes' })
  const tCategory = await getTranslations({ locale, namespace: 'Crop.categories' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const groups = groupPhotoSpecsByCategory()
  const canonicalUrl = buildCanonical('/sizes', locale as Locale)

  const itemList = itemListSchema({
    url: canonicalUrl,
    name: t('heading'),
    description: t('subtitle'),
    items: BUILTIN_PHOTO_SPECS.map((spec) => ({
      url: buildCanonical(`/sizes/${spec.id}`, locale as Locale),
      name: localizeText(spec.name, locale),
      description: spec.description ? localizeText(spec.description, locale) : undefined,
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

          <div className="space-y-12">
            {groups.map((group) => (
              <section key={group.category} aria-labelledby={`group-${group.category}`}>
                <h2
                  id={`group-${group.category}`}
                  className="mb-4 text-[var(--color-text)]"
                  style={{
                    fontSize: 'var(--text-h2)',
                    lineHeight: 'var(--text-h2--line-height)',
                  }}
                >
                  {tCategory(group.category)}
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.specs.map((spec) => {
                    const flag = flagCodeForRegion(spec.region)
                    const name = localizeText(spec.name, locale)
                    const description = spec.description
                      ? localizeText(spec.description, locale)
                      : null
                    return (
                      <li
                        key={spec.id}
                        id={spec.id}
                        className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
                      >
                        <div className="flex items-start gap-3">
                          {flag ? (
                            <RegionFlag
                              countryCode={flag}
                              label={spec.region ?? ''}
                              squared
                              className="mt-1 size-6 shrink-0"
                            />
                          ) : null}
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-[var(--color-text)]">
                              <Link
                                href={{ pathname: `/sizes/${spec.id}` }}
                                className="hover:text-[var(--color-primary-dk)]"
                              >
                                {name}
                              </Link>
                            </h3>
                            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-weak)]">
                              {spec.id}
                            </p>
                          </div>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <dt className="text-xs text-[var(--color-text-weak)]">
                              {t('fields.dimensions')}
                            </dt>
                            <dd className="text-[var(--color-text)]">
                              {spec.width_mm} × {spec.height_mm} mm
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[var(--color-text-weak)]">
                              {t('fields.pixels')}
                            </dt>
                            <dd className="font-mono text-[var(--color-text)]">
                              {spec.width_px ?? '—'} × {spec.height_px ?? '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-[var(--color-text-weak)]">
                              {t('fields.dpi')}
                            </dt>
                            <dd className="font-mono text-[var(--color-text)]">{spec.dpi}</dd>
                          </div>
                          {spec.background?.recommended ? (
                            <div>
                              <dt className="text-xs text-[var(--color-text-weak)]">
                                {t('fields.background')}
                              </dt>
                              <dd className="flex items-center gap-2 text-[var(--color-text)]">
                                <span
                                  aria-hidden="true"
                                  className="inline-block size-3 rounded-full border border-[var(--color-border)]"
                                  style={{ backgroundColor: spec.background.recommended }}
                                />
                                <span className="font-mono text-xs uppercase">
                                  {spec.background.recommended}
                                </span>
                              </dd>
                            </div>
                          ) : null}
                          {spec.fileRules?.maxKB ? (
                            <div className="col-span-2">
                              <dt className="text-xs text-[var(--color-text-weak)]">
                                {t('fields.fileSize')}
                              </dt>
                              <dd className="text-[var(--color-text)]">
                                {spec.fileRules.minKB ?? 0}–{spec.fileRules.maxKB} KB
                              </dd>
                            </div>
                          ) : null}
                        </dl>

                        {description ? (
                          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-mute)]">
                            {description}
                          </p>
                        ) : null}

                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                          <Link
                            href={{ pathname: `/sizes/${spec.id}` }}
                            className="text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
                          >
                            {t('viewDetail')}
                          </Link>
                          <Link
                            href={{
                              pathname: '/studio',
                              query: { tab: 'size', spec: spec.id },
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
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), itemList, breadcrumbs]} />
    </>
  )
}

import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { LegalPage } from '@/features/legal/legal-page'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'

interface TermsPageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Legal.terms' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/terms',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

const TERMS_SECTION_IDS = [
  'scope',
  'service',
  'responsibility',
  'compliance',
  'ip',
  'warranty',
  'liability',
  'changes',
  'law',
  'contact',
] as const

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Legal.terms' })
  const tCommon = await getTranslations({ locale, namespace: 'Legal.common' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const sections = TERMS_SECTION_IDS.map((id) => ({
    id,
    title: t(`sections.${id}.title`),
    body: t(`sections.${id}.body`),
  }))

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('studio') },
    { url: buildCanonical('/terms', locale as Locale), name: t('heading') },
  ])

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <LegalPage
          heading={t('heading')}
          subtitle={t('subtitle')}
          lastUpdated={t('lastUpdated')}
          lastUpdatedLabel={tCommon('lastUpdated')}
          sections={sections}
        />
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), breadcrumbs]} />
    </>
  )
}

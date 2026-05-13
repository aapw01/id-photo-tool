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

interface PrivacyPageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Legal.privacy' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/privacy',
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

const PRIVACY_SECTION_IDS = [
  'summary',
  'data',
  'localStorage',
  'thirdParty',
  'analytics',
  'rights',
  'children',
  'changes',
  'contact',
] as const

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Legal.privacy' })
  const tCommon = await getTranslations({ locale, namespace: 'Legal.common' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const sections = PRIVACY_SECTION_IDS.map((id) => ({
    id,
    title: t(`sections.${id}.title`),
    body: t(`sections.${id}.body`),
  }))

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('home') },
    { url: buildCanonical('/privacy', locale as Locale), name: t('heading') },
  ])

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <LegalPage
          heading={t('heading')}
          subtitle={t('subtitle')}
          lastUpdated={tCommon('lastUpdated', { date: t('lastUpdated') })}
          sections={sections}
        />
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), breadcrumbs]} />
    </>
  )
}

import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/breadcrumb'
import { JsonLd } from '@/components/jsonld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { QuickTools } from '@/features/quick-tools/quick-tools'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { breadcrumbItemsToJsonLd, getBreadcrumbItems } from '@/lib/seo/breadcrumbs'
import { buildMetadata } from '@/lib/seo/metadata'
import { webApplicationSchema } from '@/lib/seo/jsonld'

interface PageProps {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'QuickTools' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/quick-tools',
    title: t('metaTitle'),
    description: t('metaDescription'),
    keywords: t.raw('metaKeywords') as string[],
  })
}

export default async function QuickToolsPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'QuickTools' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })
  const breadcrumbItems = getBreadcrumbItems('quick-tools', {
    labels: { home: tNav('home'), quickTools: t('title') },
  })
  const breadcrumbs = breadcrumbItemsToJsonLd(breadcrumbItems, locale as Locale)
  const application = webApplicationSchema(locale as Locale, {
    keywords: t.raw('metaKeywords') as string[],
  })

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-6 pt-10 pb-16">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />
          <header className="mb-10 max-w-3xl">
            <h1
              className="font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {t('title')}
            </h1>
            <p className="mt-3 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('subtitle')}
            </p>
          </header>

          <QuickTools />

          <section className="mt-14 max-w-3xl" aria-labelledby="quick-tools-note">
            <h2
              id="quick-tools-note"
              className="text-[var(--color-text)]"
              style={{ fontSize: 'var(--text-h2)', lineHeight: 'var(--text-h2--line-height)' }}
            >
              {t('note.title')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-mute)]">
              {t('note.body')}
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={breadcrumbs} />
      <JsonLd data={application} />
    </>
  )
}

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ScannerShellLazy } from '@/features/scanner/components/scanner-shell-lazy'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { buildMetadata } from '@/lib/seo/metadata'

interface ScannerPageProps {
  params: Promise<{ locale: string }>
}

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
        <section className="mx-auto max-w-4xl px-6 pb-20" aria-labelledby="scanner-seo-intro">
          <h2
            id="scanner-seo-intro"
            className="mb-4 text-[var(--color-text)]"
            style={{
              fontSize: 'var(--text-h3)',
              lineHeight: 'var(--text-h3--line-height)',
            }}
          >
            {t('seoIntro.heading')}
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-mute)]">
            <p>{t('seoIntro.paragraphs.0')}</p>
            <p>{t('seoIntro.paragraphs.1')}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

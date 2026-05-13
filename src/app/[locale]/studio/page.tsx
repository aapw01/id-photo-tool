import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { SegmentationPrewarm } from '@/features/segmentation/segmentation-prewarm'
import { StudioWorkspace } from '@/features/studio/studio-workspace'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { buildMetadata } from '@/lib/seo/metadata'

interface StudioPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: StudioPageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Studio' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/studio',
    title: t('title'),
    description: t('subtitle'),
  })
}

export default async function StudioPage({ params }: StudioPageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('Studio')

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

          {/* Mounting the prewarm here (rather than the home page)
              scopes it to actual cut-out intent: the user has navigated
              to /studio, but we still only fire on hover / focus of
              [data-warmup-segmentation] or once the user visits the
              background tab — no idle download on a crop-only flow. */}
          <SegmentationPrewarm />
          {/* StudioWorkspace's tab-deeplink hook calls `useSearchParams`,
              which Next.js requires to sit inside a Suspense boundary
              so static prerender can bail out and resume on the client. */}
          <Suspense fallback={null}>
            <StudioWorkspace />
          </Suspense>
        </section>

        {/* SSR-rendered intro paragraphs that crawlers can read without
            executing the editor. Visually scoped to the bottom of the
            page so it doesn't compete with the live workspace, but
            still inside the same indexed URL. */}
        <section className="mx-auto max-w-4xl px-6 pb-20" aria-labelledby="studio-seo-intro">
          <h2
            id="studio-seo-intro"
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

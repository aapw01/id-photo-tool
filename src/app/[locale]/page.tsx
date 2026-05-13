import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Crop, Layout, Lock, Scaling } from 'lucide-react'

import { JsonLd } from '@/components/jsonld'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { UploadDropzone } from '@/components/upload-dropzone'
import { hasLocale } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { faqSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { notFound } from 'next/navigation'

const HOME_FAQ_KEYS = [
  'free',
  'upload',
  'background',
  'sizes',
  'compress',
  'print',
  'mobile',
] as const
const SEO_INTRO_PARAGRAPH_INDICES = [0, 1, 2] as const

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Home' })
  return buildMetadata({
    locale: locale as Locale,
    path: '/',
    title: t('heroTitle'),
    description: t('heroSubtitle'),
  })
}

const featureIcons = {
  privacy: Lock,
  smart: Crop,
  layout: Layout,
  compress: Scaling,
} as const

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('Home')
  const tCommon = await getTranslations('Common')
  const featureKeys = ['privacy', 'smart', 'layout', 'compress'] as const

  const faqEntries = HOME_FAQ_KEYS.map((key) => ({
    question: t(`faq.items.${key}.q`),
    answer: t(`faq.items.${key}.a`),
  }))
  const faq = faqSchema(faqEntries)

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
              {tCommon('brand')}
            </p>
            <h1
              className="mt-4 font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {t('heroTitle')}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('heroSubtitle')}
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <UploadDropzone />
            <p className="mt-4 text-center text-sm text-[var(--color-text-weak)]">{t('ctaHint')}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key]
              return (
                <article
                  key={key}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dk)]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-base font-semibold text-[var(--color-text)]">
                    {t(`features.${key}.title`)}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-mute)]">
                    {t(`features.${key}.desc`)}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16" aria-labelledby="home-seo-intro">
          <h2
            id="home-seo-intro"
            className="mb-6 text-[var(--color-text)]"
            style={{
              fontSize: 'var(--text-h2)',
              lineHeight: 'var(--text-h2--line-height)',
            }}
          >
            {t('seoIntro.heading')}
          </h2>
          <div className="space-y-5 leading-relaxed text-[var(--color-text-mute)]">
            {SEO_INTRO_PARAGRAPH_INDICES.map((idx) => (
              <p key={idx}>{t(`seoIntro.paragraphs.${idx}`)}</p>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-20" aria-labelledby="home-faq">
          <header className="mb-8 text-center">
            <h2
              id="home-faq"
              className="text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h2)',
                lineHeight: 'var(--text-h2--line-height)',
              }}
            >
              {t('faq.heading')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-mute)]">{t('faq.subtitle')}</p>
          </header>
          <div className="space-y-3">
            {faqEntries.map((entry, idx) => (
              <details
                key={HOME_FAQ_KEYS[idx]}
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
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), faq]} />
    </>
  )
}

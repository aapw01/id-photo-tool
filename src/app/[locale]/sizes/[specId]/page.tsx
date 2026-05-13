import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/jsonld'
import { RegionFlag } from '@/components/region-flag'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BUILTIN_PHOTO_SPECS, getPhotoSpec } from '@/data/photo-specs'
import { flagCodeForRegion } from '@/features/seo/spec-region'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import { breadcrumbSchema, faqSchema, howToSchema, webApplicationSchema } from '@/lib/seo/jsonld'
import { buildCanonical, buildMetadata } from '@/lib/seo/metadata'
import type { PhotoCategory, PhotoSpec } from '@/types/spec'

interface SpecDetailPageProps {
  params: Promise<{ locale: string; specId: string }>
}

const REGION_NAME: Record<string, { zh: string; 'zh-Hant': string; en: string }> = {
  CN: { zh: '中国', 'zh-Hant': '中國', en: 'China' },
  US: { zh: '美国', 'zh-Hant': '美國', en: 'the United States' },
  EU: { zh: '欧洲申根区', 'zh-Hant': '歐洲申根區', en: 'the Schengen Area' },
  GB: { zh: '英国', 'zh-Hant': '英國', en: 'the United Kingdom' },
  CA: { zh: '加拿大', 'zh-Hant': '加拿大', en: 'Canada' },
  AU: { zh: '澳大利亚', 'zh-Hant': '澳洲', en: 'Australia' },
  NZ: { zh: '新西兰', 'zh-Hant': '紐西蘭', en: 'New Zealand' },
  JP: { zh: '日本', 'zh-Hant': '日本', en: 'Japan' },
  KR: { zh: '韩国', 'zh-Hant': '韓國', en: 'Korea' },
  SG: { zh: '新加坡', 'zh-Hant': '新加坡', en: 'Singapore' },
  MY: { zh: '马来西亚', 'zh-Hant': '馬來西亞', en: 'Malaysia' },
  VN: { zh: '越南', 'zh-Hant': '越南', en: 'Vietnam' },
  TH: { zh: '泰国', 'zh-Hant': '泰國', en: 'Thailand' },
  RU: { zh: '俄罗斯', 'zh-Hant': '俄羅斯', en: 'Russia' },
  IN: { zh: '印度', 'zh-Hant': '印度', en: 'India' },
}

function regionDisplayName(region: string | undefined, locale: Locale): string {
  if (!region) return ''
  const entry = REGION_NAME[region.toUpperCase()]
  if (!entry) return region
  return locale === 'zh-Hans' ? entry.zh : locale === 'zh-Hant' ? entry['zh-Hant'] : entry.en
}

interface BackgroundLabel {
  hex: string | null
  label: string
}

function backgroundLabel(spec: PhotoSpec, locale: Locale): BackgroundLabel {
  const hex = spec.background?.recommended ?? null
  if (!hex) {
    return {
      hex: null,
      label: locale === 'en' ? 'transparent' : '透明',
    }
  }
  const normalised = hex.toUpperCase()
  const dict: Record<string, { zh: string; 'zh-Hant': string; en: string }> = {
    '#FFFFFF': { zh: '标准白底', 'zh-Hant': '標準白底', en: 'standard white' },
    '#DCDCDC': { zh: '浅灰底', 'zh-Hant': '淺灰底', en: 'light grey' },
    '#438EDB': { zh: '证件蓝', 'zh-Hant': '證件藍', en: 'visa blue' },
    '#D9342B': { zh: '证件红', 'zh-Hant': '證件紅', en: 'ID red' },
  }
  const entry = dict[normalised]
  if (!entry) {
    return { hex: normalised, label: normalised }
  }
  const label = locale === 'zh-Hans' ? entry.zh : locale === 'zh-Hant' ? entry['zh-Hant'] : entry.en
  return { hex: normalised, label }
}

function formatFileRuleRange(minKB?: number, maxKB?: number): string | null {
  if (minKB != null && maxKB != null) return `${minKB}–${maxKB} KB`
  if (maxKB != null) return `≤ ${maxKB} KB`
  if (minKB != null) return `≥ ${minKB} KB`
  return null
}

export function generateStaticParams() {
  const params: Array<{ locale: string; specId: string }> = []
  for (const locale of routing.locales) {
    for (const spec of BUILTIN_PHOTO_SPECS) {
      params.push({ locale, specId: spec.id })
    }
  }
  return params
}

export async function generateMetadata({ params }: SpecDetailPageProps): Promise<Metadata> {
  const { locale, specId } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const spec = getPhotoSpec(specId)
  if (!spec) return {}
  const t = await getTranslations({ locale, namespace: 'Sizes.detail' })
  const name = localizeText(spec.name, locale)
  const bg = backgroundLabel(spec, locale as Locale)
  return buildMetadata({
    locale: locale as Locale,
    path: `/sizes/${spec.id}`,
    title: t('metaTitle', {
      name,
      w: spec.width_mm,
      h: spec.height_mm,
    }),
    description: t('metaDescription', {
      name,
      w: spec.width_mm,
      h: spec.height_mm,
      wpx: spec.width_px ?? '—',
      hpx: spec.height_px ?? '—',
      dpi: spec.dpi,
      bgLabel: bg.label,
    }),
  })
}

const HOWTO_STEP_KEYS = ['upload', 'cutout', 'crop', 'export'] as const
const FAQ_ITEM_KEYS = ['free', 'upload', 'background', 'accuracy', 'phone'] as const

export default async function SpecDetailPage({ params }: SpecDetailPageProps) {
  const { locale, specId } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const spec = getPhotoSpec(specId)
  if (!spec) notFound()
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'Sizes.detail' })
  const tSizes = await getTranslations({ locale, namespace: 'Sizes' })
  const tNav = await getTranslations({ locale, namespace: 'Nav' })

  const name = localizeText(spec.name, locale)
  const bg = backgroundLabel(spec, locale as Locale)
  const regionName = regionDisplayName(spec.region, locale as Locale)
  const fileRulesRange = formatFileRuleRange(spec.fileRules?.minKB, spec.fileRules?.maxKB)
  const flag = flagCodeForRegion(spec.region)

  const canonicalUrl = buildCanonical(`/sizes/${spec.id}`, locale as Locale)
  const sizesUrl = buildCanonical('/sizes', locale as Locale)

  const breadcrumbs = breadcrumbSchema([
    { url: buildCanonical('/', locale as Locale), name: tNav('home') },
    { url: sizesUrl, name: tSizes('heading') },
    { url: canonicalUrl, name },
  ])

  const howToSteps = HOWTO_STEP_KEYS.map((key) => ({
    name: t(`howto.steps.${key}.name`, { name }),
    text: t(`howto.steps.${key}.text`, {
      name,
      w: spec.width_mm,
      h: spec.height_mm,
      bgLabel: bg.label,
    }),
  }))

  const howTo = howToSchema({
    name: t('howto.title', { name }),
    description: t('howto.subtitle'),
    totalTimeISO: 'PT2M',
    steps: howToSteps,
  })

  const faqEntries = FAQ_ITEM_KEYS.map((key) => ({
    question: t(`faq.items.${key}.q`, { name }),
    answer: t(`faq.items.${key}.a`, { name, bgLabel: bg.label }),
  }))
  const faq = faqSchema(faqEntries)

  const purposeKey = `purpose.${spec.category as PhotoCategory}` as const
  const purposeBody =
    spec.category === 'custom'
      ? null
      : t(purposeKey, {
          name,
          regionName: regionName || (locale === 'en' ? 'the destination country' : '目标国家'),
        })

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-4xl px-6 pt-10 pb-16">
          <nav className="mb-6">
            <Link
              href={{ pathname: '/sizes' }}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('backLink')}
            </Link>
          </nav>

          <header className="mb-10">
            <div className="flex items-center gap-3">
              {flag ? (
                <RegionFlag
                  countryCode={flag}
                  label={spec.region ?? ''}
                  squared
                  className="size-7"
                />
              ) : null}
              <span className="font-mono text-xs tracking-[0.25em] text-[var(--color-primary-dk)] uppercase">
                {spec.id}
              </span>
            </div>
            <h1
              className="mt-3 font-semibold tracking-tight text-balance text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-display-2)',
                lineHeight: 'var(--text-display-2--line-height)',
              }}
            >
              {t('heading', { name })}
            </h1>
            <p className="mt-3 font-mono text-sm text-[var(--color-text-weak)]">
              {t('tagline', {
                w: spec.width_mm,
                h: spec.height_mm,
                wpx: spec.width_px ?? '—',
                hpx: spec.height_px ?? '—',
                dpi: spec.dpi,
              })}
            </p>
            <p className="mt-5 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
              {t('intro', {
                name,
                w: spec.width_mm,
                h: spec.height_mm,
                wpx: spec.width_px ?? '—',
                hpx: spec.height_px ?? '—',
                dpi: spec.dpi,
                bgLabel: bg.label,
              })}
            </p>
          </header>

          <section
            className="mb-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            aria-labelledby="spec-section"
          >
            <h2
              id="spec-section"
              className="mb-4 text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h3)',
                lineHeight: 'var(--text-h3--line-height)',
              }}
            >
              {t('specSection.title')}
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">
                  {t('specSection.dimensions')}
                </dt>
                <dd className="mt-1 text-[var(--color-text)]">
                  {spec.width_mm} × {spec.height_mm} mm
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">{t('specSection.pixels')}</dt>
                <dd className="mt-1 font-mono text-[var(--color-text)]">
                  {spec.width_px ?? '—'} × {spec.height_px ?? '—'} px
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-weak)]">{t('specSection.dpi')}</dt>
                <dd className="mt-1 font-mono text-[var(--color-text)]">{spec.dpi}</dd>
              </div>
              {bg.hex ? (
                <div>
                  <dt className="text-xs text-[var(--color-text-weak)]">
                    {t('specSection.background')}
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-[var(--color-text)]">
                    <span
                      aria-hidden="true"
                      className="inline-block size-4 rounded-sm border border-[var(--color-border)]"
                      style={{ backgroundColor: bg.hex }}
                    />
                    <span>{bg.label}</span>
                    <span className="font-mono text-xs text-[var(--color-text-weak)]">
                      {bg.hex}
                    </span>
                  </dd>
                </div>
              ) : null}
              {fileRulesRange ? (
                <div>
                  <dt className="text-xs text-[var(--color-text-weak)]">
                    {t('specSection.fileSize')}
                  </dt>
                  <dd className="mt-1 text-[var(--color-text)]">{fileRulesRange}</dd>
                </div>
              ) : null}
              {regionName ? (
                <div>
                  <dt className="text-xs text-[var(--color-text-weak)]">
                    {t('specSection.region')}
                  </dt>
                  <dd className="mt-1 text-[var(--color-text)]">{regionName}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {purposeBody ? (
            <section className="mb-12" aria-labelledby="purpose-section">
              <h2
                id="purpose-section"
                className="mb-3 text-[var(--color-text)]"
                style={{
                  fontSize: 'var(--text-h3)',
                  lineHeight: 'var(--text-h3--line-height)',
                }}
              >
                {t('purpose.title')}
              </h2>
              <p className="leading-relaxed text-[var(--color-text-mute)]">{purposeBody}</p>
            </section>
          ) : null}

          <section className="mb-12" aria-labelledby="requirements-section">
            <h2
              id="requirements-section"
              className="mb-3 text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h3)',
                lineHeight: 'var(--text-h3--line-height)',
              }}
            >
              {t('requirements.title')}
            </h2>
            <p className="leading-relaxed text-[var(--color-text-mute)]">
              {t('requirements.body', { bgLabel: bg.label })}
            </p>
            {fileRulesRange ? (
              <p className="mt-3 text-sm text-[var(--color-text-mute)]">
                {t('requirements.fileRules', { range: fileRulesRange })}
              </p>
            ) : null}
          </section>

          <section className="mb-12" aria-labelledby="howto-section">
            <h2
              id="howto-section"
              className="mb-2 text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h3)',
                lineHeight: 'var(--text-h3--line-height)',
              }}
            >
              {t('howto.title', { name })}
            </h2>
            <p className="mb-6 text-sm text-[var(--color-text-mute)]">{t('howto.subtitle')}</p>
            <ol className="space-y-4">
              {howToSteps.map((step, idx) => (
                <li
                  key={HOWTO_STEP_KEYS[idx]}
                  className="flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-mono text-sm font-semibold text-[var(--color-primary-dk)]">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text)]">{step.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-mute)]">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-12" aria-labelledby="faq-section">
            <h2
              id="faq-section"
              className="mb-4 text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h3)',
                lineHeight: 'var(--text-h3--line-height)',
              }}
            >
              {t('faq.title', { name })}
            </h2>
            <div className="space-y-4">
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

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)] p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 font-medium text-[var(--color-primary-dk)]">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {name}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={{
                    pathname: '/studio',
                    query: { tab: 'size', spec: spec.id },
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
                >
                  {t('cta.primary', { name })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href={{ pathname: '/sizes' }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dk)] hover:text-[var(--color-primary)]"
                >
                  {t('cta.secondary')}
                </Link>
              </div>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={[webApplicationSchema(locale as Locale), breadcrumbs, howTo, faq]} />
    </>
  )
}

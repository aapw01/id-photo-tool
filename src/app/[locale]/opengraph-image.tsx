/**
 * Home-page OG image — emits one 1200×630 card per locale.
 *
 * Statically generated at build time (no per-request data fetching),
 * so the satori bundle never ships in the runtime Cloudflare Worker.
 *
 * The card carries: brand chip → big home headline → benefit line.
 */

import { getTranslations } from 'next-intl/server'

import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og-image'

export const alt = 'Pixfit · 像配'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

interface OgProps {
  params: { locale: string }
}

export default async function HomeOgImage({ params }: OgProps) {
  const t = await getTranslations({ locale: params.locale, namespace: 'Home' })
  const tCommon = await getTranslations({ locale: params.locale, namespace: 'Common' })
  return renderOgImage({
    headline: t('heroTitle'),
    subtitle: tCommon('tagline'),
    eyebrow: tCommon('brand'),
  })
}

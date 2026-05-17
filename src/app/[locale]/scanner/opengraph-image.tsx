/**
 * Scanner index OG image — one card per locale, statically generated.
 *
 * Card content: brand eyebrow → scanner product headline →
 * "12 document types · in-browser" tagline.
 */

import { getTranslations } from 'next-intl/server'

import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og-image'

export const alt = 'Pixfit Scanner'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

interface OgProps {
  params: { locale: string }
}

export default async function ScannerOgImage({ params }: OgProps) {
  const t = await getTranslations({ locale: params.locale, namespace: 'Scanner' })
  return renderOgImage({
    eyebrow: 'Pixfit Scanner',
    headline: t('title'),
    subtitle: t('subtitle').slice(0, 110),
  })
}

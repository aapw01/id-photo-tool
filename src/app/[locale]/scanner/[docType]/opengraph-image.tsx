/**
 * Scanner DocType OG image — one card per (locale, docType).
 *
 * Card content:
 *   eyebrow  → "Pixfit Scanner"
 *   headline → translated DocType name (e.g. "PRC Resident ID")
 *   subtitle → "{widthMm} × {heightMm} mm"
 */

import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { getDocSpec } from '@/features/scanner/lib/doc-specs'
import { routing } from '@/i18n/routing'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og-image'

export const alt = 'Pixfit Scanner · document'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

interface OgProps {
  // Next.js 16: params is a Promise, must be awaited.
  params: Promise<{ locale: string; docType: string }>
}

export default async function ScannerDocOgImage({ params }: OgProps) {
  const { locale, docType } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound()
  const spec = getDocSpec(docType)
  if (!spec) notFound()
  const t = await getTranslations({ locale, namespace: 'Scanner.docSpecs' })
  const docName = t(spec.id as Parameters<typeof t>[0])
  return renderOgImage({
    eyebrow: 'Pixfit Scanner',
    headline: docName,
    subtitle: `${spec.widthMm} × ${spec.heightMm} mm`,
  })
}

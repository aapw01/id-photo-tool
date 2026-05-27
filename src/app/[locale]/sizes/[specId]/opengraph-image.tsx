/**
 * Spec detail OG image — one card per (locale, specId).
 *
 * Card content:
 *   eyebrow  → "Pixfit"
 *   headline → localised spec name (e.g. "US visa", "一寸照")
 *   subtitle → "{widthMm} × {heightMm} mm · {widthPx} × {heightPx} px"
 */

import { notFound } from 'next/navigation'

import { getPhotoSpec } from '@/data/photo-specs'
import { routing } from '@/i18n/routing'
import { localizeText } from '@/lib/i18n-text'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og-image'

export const alt = 'Pixfit · photo spec'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

interface OgProps {
  // Next.js 16: params is a Promise, not a synchronous object. Reading
  // it without await silently returns undefined on every field, so the
  // OG card ends up rendering a fallback name for every spec.
  params: Promise<{ locale: string; specId: string }>
}

export default async function SpecOgImage({ params }: OgProps) {
  const { locale, specId } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound()
  const spec = getPhotoSpec(specId)
  if (!spec) notFound()
  const name = localizeText(spec.name, locale)
  const pixelLine =
    spec.width_px && spec.height_px ? ` · ${spec.width_px} × ${spec.height_px} px` : ''
  return renderOgImage({
    eyebrow: 'Pixfit',
    headline: name,
    subtitle: `${spec.width_mm} × ${spec.height_mm} mm${pixelLine}`,
  })
}

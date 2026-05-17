/**
 * Blog article OG image — one card per (locale, slug).
 *
 * Card content:
 *   eyebrow  → "Pixfit Blog"
 *   headline → article title in the active locale
 *   subtitle → "{author} · {datePublished}"
 */

import { notFound } from 'next/navigation'

import { getBlogPost } from '@/content/blog'
import { getArticleBody } from '@/content/blog/loader'
import { routing, type Locale } from '@/i18n/routing'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og-image'
import { SITE_NAME_FULL } from '@/lib/seo/site-config'

export const alt = 'Pixfit Blog'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

interface OgProps {
  params: { locale: string; slug: string }
}

export default async function BlogArticleOgImage({ params }: OgProps) {
  if (!routing.locales.includes(params.locale as Locale)) notFound()
  const post = getBlogPost(params.slug)
  if (!post) notFound()
  const body = getArticleBody(params.slug, params.locale as Locale)
  if (!body) notFound()

  const dateFormatter = new Intl.DateTimeFormat(params.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return renderOgImage({
    eyebrow: 'Pixfit Blog',
    headline: body.title,
    subtitle: `${SITE_NAME_FULL} · ${dateFormatter.format(new Date(post.datePublished))}`,
  })
}

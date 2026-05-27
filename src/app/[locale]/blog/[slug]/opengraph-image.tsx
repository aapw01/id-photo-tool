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
  // Next.js 16: params is a Promise, must be awaited.
  params: Promise<{ locale: string; slug: string }>
}

export default async function BlogArticleOgImage({ params }: OgProps) {
  const { locale, slug } = await params
  if (!routing.locales.includes(locale as Locale)) notFound()
  const post = getBlogPost(slug)
  if (!post) notFound()
  const body = getArticleBody(slug, locale as Locale)
  if (!body) notFound()

  const dateFormatter = new Intl.DateTimeFormat(locale, {
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

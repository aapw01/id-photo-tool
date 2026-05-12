/**
 * Pure helpers for building Next.js `Metadata` objects with full
 * hreflang / canonical / OG / Twitter coverage.
 *
 * Callers pass the route-relative `path` (e.g. `/studio`) plus the
 * active locale; the helpers handle locale prefixing, absolute URL
 * generation, and the `x-default` mapping.
 */

import type { Metadata } from 'next'

import type { Locale } from '@/i18n/routing'

import {
  DEFAULT_LOCALE,
  HREFLANG_BY_LOCALE,
  SITE_NAME,
  SITE_NAME_FULL,
  SITE_URL,
  SUPPORTED_LOCALES,
} from './site-config'

/** Normalise a path so it always starts with `/` and never ends with one. */
export function normalizePath(path: string): string {
  if (!path || path === '/') return '/'
  const trimmed = path.trim()
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/** Absolute URL for a locale-prefixed path. */
export function buildCanonical(path: string, locale: Locale): string {
  const tail = normalizePath(path)
  const suffix = tail === '/' ? '' : tail
  return `${SITE_URL}/${locale}${suffix}`
}

/** `{ 'zh-Hans': URL, 'zh-Hant': URL, en: URL, 'x-default': URL }`. */
export function buildAlternateLanguages(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const locale of SUPPORTED_LOCALES) {
    out[HREFLANG_BY_LOCALE[locale]] = buildCanonical(path, locale)
  }
  out['x-default'] = buildCanonical(path, DEFAULT_LOCALE)
  return out
}

interface BuildMetadataOptions {
  locale: Locale
  /** Path under the locale prefix, e.g. `/studio`, `/sizes`, `/`. */
  path: string
  title: string
  description: string
  /** OG image path relative to SITE_URL (defaults to /og/default.png). */
  image?: string
  /** When true, instructs robots to skip indexing (404 / error / dev). */
  noIndex?: boolean
}

/** Build a complete `Metadata` block with canonical + alternates + OG. */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const canonical = buildCanonical(opts.path, opts.locale)
  const ogImage = opts.image ?? '/og/default.png'
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${SITE_URL}${ogImage}`

  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical,
      languages: buildAlternateLanguages(opts.path),
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME_FULL,
      locale: ogLocaleFor(opts.locale),
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== opts.locale).map(ogLocaleFor),
      url: canonical,
      title: opts.title,
      description: opts.description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [ogImageUrl],
    },
    applicationName: SITE_NAME,
    robots: opts.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  }
}

/** Convert a Pixfit locale into an OG-format locale (`zh_CN` etc.). */
export function ogLocaleFor(locale: Locale): string {
  switch (locale) {
    case 'zh-Hans':
      return 'zh_CN'
    case 'zh-Hant':
      return 'zh_TW'
    case 'en':
    default:
      return 'en_US'
  }
}

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
  HREFLANG_BY_LOCALE,
  SITE_NAME,
  SITE_NAME_FULL,
  SITE_URL,
  SUPPORTED_LOCALES,
  X_DEFAULT_LOCALE,
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
  out['x-default'] = buildCanonical(path, X_DEFAULT_LOCALE)
  return out
}

interface BuildMetadataOptions {
  locale: Locale
  /** Path under the locale prefix, e.g. `/studio`, `/sizes`, `/`. */
  path: string
  title: string
  description: string
  /**
   * When true, the resulting `title` field becomes an `absolute`
   * object so Next does NOT apply the root layout's
   * `template` ("%s · Pixfit · 像配"). Use this for the home page —
   * the brand is already in the title, and double-stamping reads as
   * spam. Default `false` so per-page titles keep getting the brand
   * suffix automatically.
   */
  titleAbsolute?: boolean
  /**
   * Optional keyword cluster. May be a comma-joined string or an array
   * — Next normalises both into the same `<meta name="keywords">` tag.
   * When supplied, the same list is mirrored into the OG / Twitter
   * card descriptions via JSON-LD on the calling page (the JSON-LD
   * helpers carry their own keyword pass-through).
   *
   * Pixfit keeps this curated per page in the i18n bundles so the
   * cluster reads benefit-first per locale (Simplified vs Traditional
   * Chinese vs English long-tails differ markedly).
   */
  keywords?: readonly string[] | string
  /** OG image path relative to SITE_URL. Defaults to `/og/default.png`. */
  image?: string
  /** When true, instructs robots to skip indexing (404 / error / dev). */
  noIndex?: boolean
}

/**
 * Static OG fallback. We deliberately ship the default card as a real
 * PNG asset rather than generating it with `@vercel/og` / `ImageResponse`
 * at runtime: the satori bundle is ~700 KB and was the single biggest
 * contributor to Cloudflare Worker cold-start CPU on the free tier
 * (which caps every request at 10 ms). Pulling it out of the worker
 * graph by deleting `src/app/opengraph-image.tsx` and pointing the
 * default OG image at a static asset under `/og/default.png` cuts the
 * server function bundle by ~700 KB without losing the social card.
 */
const DEFAULT_OG_IMAGE_PATH = '/og/default.png'

/** Build a complete `Metadata` block with canonical + alternates + OG. */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const canonical = buildCanonical(opts.path, opts.locale)
  const imagePath = opts.image ?? DEFAULT_OG_IMAGE_PATH
  const customImageUrl = imagePath.startsWith('http') ? imagePath : `${SITE_URL}${imagePath}`

  const openGraph: NonNullable<Metadata['openGraph']> = {
    type: 'website',
    siteName: SITE_NAME_FULL,
    locale: ogLocaleFor(opts.locale),
    alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== opts.locale).map(ogLocaleFor),
    url: canonical,
    title: opts.title,
    description: opts.description,
    images: [{ url: customImageUrl, width: 1200, height: 630, alt: opts.title }],
  }

  const twitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title: opts.title,
    description: opts.description,
    images: [customImageUrl],
  }

  const keywords = normalizeKeywords(opts.keywords)
  const title: Metadata['title'] = opts.titleAbsolute ? { absolute: opts.title } : opts.title

  return {
    title,
    description: opts.description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical,
      languages: buildAlternateLanguages(opts.path),
    },
    openGraph,
    twitter,
    applicationName: SITE_NAME,
    robots: opts.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  }
}

/**
 * Coerce the caller's keyword input into the deduped string array
 * Next expects. We normalise eagerly so downstream JSON-LD helpers
 * can reuse the same canonical list.
 */
export function normalizeKeywords(
  input: readonly string[] | string | undefined,
): string[] | undefined {
  if (input == null) return undefined
  const raw = Array.isArray(input)
    ? input
    : String(input)
        .split(',')
        .map((s) => s.trim())
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out.length > 0 ? out : undefined
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

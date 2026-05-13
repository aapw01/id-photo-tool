/**
 * Single source of truth for Pixfit's SEO-facing site identity.
 *
 * `SITE_URL` is read from `NEXT_PUBLIC_SITE_URL` at build time so
 * staging / preview deployments can override the canonical host.
 * Trailing slashes are stripped to keep URL joins predictable.
 */

import type { Locale } from '@/i18n/routing'

const DEFAULT_SITE_URL = 'https://pix-fit.com'

function readSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const raw = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SITE_URL
  return raw.replace(/\/+$/, '')
}

export const SITE_URL = readSiteUrl()
export const SITE_NAME = 'Pixfit'
export const SITE_NAME_FULL = 'Pixfit · 像配'

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-Hans', 'zh-Hant', 'en'] as const
export const DEFAULT_LOCALE: Locale = 'zh-Hans'

/**
 * Locale used for the `x-default` hreflang entry. We target the global
 * English audience here (rather than the routing default of `zh-Hans`)
 * so that visitors hitting Pixfit without a matched language hint are
 * sent to the English UI instead of Simplified Chinese.
 */
export const X_DEFAULT_LOCALE: Locale = 'en'

/** Pixfit brand colour used in `<meta name="theme-color">` and OG art. */
export const BRAND_PRIMARY_HEX = '#10b981'

/** Locale → hreflang code used by Google. */
export const HREFLANG_BY_LOCALE: Record<Locale, string> = {
  'zh-Hans': 'zh-Hans',
  'zh-Hant': 'zh-Hant',
  en: 'en',
}

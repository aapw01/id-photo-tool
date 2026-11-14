import { defineRouting } from 'next-intl/routing'

export type Locale =
  | 'zh-Hans'
  | 'zh-Hant'
  | 'en'
  | 'ja'
  | 'ko'
  | 'es'
  | 'pt-BR'
  | 'fr'
  | 'de'
  | 'it'
  | 'vi'

export const routing = defineRouting({
  locales: ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'pt-BR', 'fr', 'de', 'it', 'vi'] as const,
  defaultLocale: 'zh-Hans',
  localePrefix: 'always',
  localeDetection: true,
})

/**
 * Locales that render right-to-left. Used by the root layout to set
 * `<html dir="rtl">` so Tailwind's flex / grid utilities mirror
 * automatically. Keep this purely data-driven so adding new RTL
 * locales (Hebrew, Urdu, Persian) becomes a one-line edit.
 */
const RTL_LOCALES = new Set<Locale>()

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale)
}

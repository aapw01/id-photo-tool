/**
 * Resolve a project `I18nText` payload to the active next-intl locale.
 *
 * The two namespaces use slightly different locale codes:
 *
 *   next-intl     I18nText key
 *   ─────────     ────────────
 *   zh-Hans   →   zh
 *   zh-Hant   →   zh-Hant
 *   en        →   en
 *   ja        →   ja
 *   ko        →   ko
 *   es        →   es
 *   pt-BR     →   pt-BR
 *   fr        →   fr
 *   de        →   de
 *   it        →   it
 *   vi        →   vi
 *
 * `en` is the universal fallback whenever the requested locale's
 * translation is missing (built-in data is being rolled out
 * incrementally, and user-imported JSON may omit most keys).
 */

import { routing } from '@/i18n/routing'
import type { I18nText } from '@/types/spec'

/** Every locale next-intl is configured to serve. */
export type AppLocale = (typeof routing.locales)[number]

/**
 * Map a next-intl locale string to the matching `I18nText` key. The
 * only divergence is `zh-Hans` → `zh` (next-intl ships the BCP-47
 * regional code; our data files predate that and key with `zh`).
 */
export const LOCALE_TO_I18N: Record<AppLocale, keyof I18nText> = {
  'zh-Hans': 'zh',
  'zh-Hant': 'zh-Hant',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  'pt-BR': 'pt-BR',
  fr: 'fr',
  de: 'de',
  it: 'it',
  vi: 'vi',
}

/**
 * Resolve `text` to a string for `locale`. Falls back to English
 * whenever the requested locale (or any non-app locale string) is
 * missing from the payload. Legacy `zh-Hans` payloads that key the
 * Simplified Chinese variant under `zh-Hans` instead of `zh` are
 * also honoured.
 */
export function localizeText(text: I18nText, locale: string | AppLocale): string {
  if (locale === 'zh-Hans') {
    // Legacy payloads may key Simplified Chinese under `zh-Hans`;
    // current data files use `zh`. Try both before falling back.
    return (text as Partial<Record<string, string>>)['zh-Hans'] ?? text.zh ?? text.en
  }
  const key = LOCALE_TO_I18N[locale as AppLocale]
  if (key && text[key] != null) return text[key] as string
  return text.en
}

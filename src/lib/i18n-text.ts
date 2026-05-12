/**
 * Translate a project I18nText payload (with keys `zh`, `zh-Hant`,
 * `en`) into the active next-intl locale. The locales differ in
 * spelling — `zh-Hans` ↔ `zh` — so we centralise the map here.
 */

import type { I18nText } from '@/types/spec'

export type AppLocale = 'en' | 'zh-Hans' | 'zh-Hant'

const LOCALE_TO_I18N: Record<AppLocale, keyof I18nText> = {
  en: 'en',
  'zh-Hans': 'zh',
  'zh-Hant': 'zh-Hant',
}

export function localizeText(text: I18nText, locale: string | AppLocale): string {
  const key = LOCALE_TO_I18N[locale as AppLocale] ?? 'en'
  return text[key] ?? text.en
}

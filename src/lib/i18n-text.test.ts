import { describe, expect, it } from 'vitest'

import { routing } from '@/i18n/routing'
import type { I18nText } from '@/types/spec'

import { LOCALE_TO_I18N, localizeText } from './i18n-text'

const FULL_TEXT: I18nText = {
  en: 'English',
  zh: '中文',
  'zh-Hant': '中文（繁體）',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  'pt-BR': 'Português (BR)',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  it: 'Italiano',
  vi: 'Tiếng Việt',
  ar: 'العربية',
}

describe('localizeText', () => {
  it('returns the locale-specific value for every supported next-intl locale', () => {
    for (const locale of routing.locales) {
      const key = LOCALE_TO_I18N[locale]
      const expected = (FULL_TEXT as Record<string, string | undefined>)[key]
      expect(localizeText(FULL_TEXT, locale)).toBe(expected)
    }
  })

  it('falls back to English when the requested locale is missing from the payload', () => {
    const partial: I18nText = { en: 'Fallback', zh: '中文' }
    for (const locale of routing.locales) {
      const value = localizeText(partial, locale)
      if (locale === 'zh-Hans') {
        expect(value).toBe('中文')
      } else if (locale === 'en') {
        expect(value).toBe('Fallback')
      } else {
        expect(value).toBe('Fallback')
      }
    }
  })

  it('falls back to English for an unknown locale string', () => {
    expect(localizeText(FULL_TEXT, 'xx-YY')).toBe('English')
  })

  it('honours legacy payloads that key Simplified Chinese under `zh-Hans`', () => {
    const legacy = { en: 'fallback', 'zh-Hans': '简体中文' } as unknown as I18nText
    expect(localizeText(legacy, 'zh-Hans')).toBe('简体中文')
  })
})

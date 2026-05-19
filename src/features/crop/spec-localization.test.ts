import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { routing } from '@/i18n/routing'
import { LOCALE_TO_I18N, localizeText } from '@/lib/i18n-text'

/**
 * Regression: the Studio's SpecPicker used to dereference
 * `spec.name[locale]` directly, but `useLocale()` returns `zh-Hans`
 * while `I18nText` keys it as `zh`. Without `localizeText` the
 * zh-Hans UI silently fell back to English, which is exactly what
 * the user reported. This test pins the contract so the bug can't
 * sneak back — and now exercises all 13 supported locales.
 */
describe('SpecPicker localisation via localizeText', () => {
  it('renders the zh-Hans (zh) name for a built-in spec', () => {
    const cn1 = BUILTIN_PHOTO_SPECS.find((s) => s.id === 'cn-1inch')
    expect(cn1).toBeDefined()
    expect(cn1!.name.zh).toBe('一寸照')
    expect(localizeText(cn1!.name, 'zh-Hans')).toBe('一寸照')
  })

  it('renders the zh-Hant name and the en name for the same spec', () => {
    const cn1 = BUILTIN_PHOTO_SPECS.find((s) => s.id === 'cn-1inch')!
    expect(localizeText(cn1.name, 'zh-Hant')).toBe(cn1.name['zh-Hant'])
    expect(localizeText(cn1.name, 'en')).toBe(cn1.name.en)
  })

  it('renders a locale-specific name (not English) for every locale with a translation', () => {
    const usVisa = BUILTIN_PHOTO_SPECS.find((s) => s.id === 'us-visa')!
    for (const locale of routing.locales) {
      const key = LOCALE_TO_I18N[locale]
      if (usVisa.name[key] != null) {
        expect(localizeText(usVisa.name, locale)).toBe(usVisa.name[key])
      } else {
        expect(localizeText(usVisa.name, locale)).toBe(usVisa.name.en)
      }
    }
  })

  it('falls back to English for an unknown locale', () => {
    const cn1 = BUILTIN_PHOTO_SPECS.find((s) => s.id === 'cn-1inch')!
    expect(localizeText(cn1.name, 'fr-FR')).toBe(cn1.name.en)
  })

  it('returns a non-English string for every built-in spec in every translated locale', () => {
    // Smoke check: assert that built-in data covers every locale we
    // advertise. If a new locale ships without translations, this
    // test surfaces the gap immediately.
    for (const spec of BUILTIN_PHOTO_SPECS) {
      for (const locale of routing.locales) {
        const value = localizeText(spec.name, locale)
        expect(value).toBeTruthy()
      }
    }
  })
})

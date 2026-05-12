import { describe, expect, it } from 'vitest'

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { localizeText } from '@/lib/i18n-text'

/**
 * Regression: the Studio's SpecPicker used to dereference
 * `spec.name[locale]` directly, but `useLocale()` returns `zh-Hans`
 * while `I18nText` keys it as `zh`. Without `localizeText` the
 * zh-Hans UI silently fell back to English, which is exactly what
 * the user reported. This test pins the contract so the bug can't
 * sneak back.
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

  it('falls back to English for an unknown locale', () => {
    const cn1 = BUILTIN_PHOTO_SPECS.find((s) => s.id === 'cn-1inch')!
    expect(localizeText(cn1.name, 'fr-FR')).toBe(cn1.name.en)
  })
})

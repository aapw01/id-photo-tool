/**
 * Built-in PaperSpec library — first edition.
 *
 * 7 papers covering the most common Chinese print formats plus A4/A5
 * for office printing. Pixel dimensions follow PRD §5.5.2.
 *
 * | name  | alias | dimensions  | px (300 DPI)    |
 * | ----- | ----- | ----------- | --------------- |
 * | 5 寸 | 3R    | 127 × 89 mm | 1500 × 1050     |
 * | 6 寸 | 4R    | 152 × 102   | 1800 × 1200     |
 * | 7 寸 | 5R    | 178 × 127   | 2100 × 1500     |
 * | 8 寸 | 6R    | 203 × 152   | 2400 × 1800     |
 * | 10 寸| 8R    | 254 × 203   | 3000 × 2400     |
 * | A4    | —     | 210 × 297   | 2480 × 3508     |
 * | A5    | —     | 148 × 210   | 1748 × 2480     |
 */

import type { I18nText, PaperSpec } from '@/types/spec'

/**
 * Locales added in the 8-locale expansion. The print-size codes
 * (3R / 4R / 5R / 6R / 8R, A4 / A5) are international, so the
 * translation work is just the trailing inch/pulgada/pollice noun
 * and (for A-series) the language-native word for "paper".
 */
type LocaleExtras = Partial<
  Record<'ja' | 'ko' | 'es' | 'pt-BR' | 'fr' | 'de' | 'it' | 'vi', string>
>

const i18n = (zh: string, zhHant: string, en: string, more: LocaleExtras = {}): I18nText => ({
  zh,
  'zh-Hant': zhHant,
  en,
  ...more,
})

export const BUILTIN_PAPER_SPECS: PaperSpec[] = [
  {
    id: '3R',
    builtin: true,
    alias: '5 寸',
    name: i18n('5 寸 (3R)', '5 吋 (3R)', '5-inch (3R)', {
      ja: '5インチ (3R)',
      ko: '5인치 (3R)',
      es: '5 pulgadas (3R)',
      'pt-BR': '5 polegadas (3R)',
      fr: '5 pouces (3R)',
      de: '5 Zoll (3R)',
      it: '5 pollici (3R)',
      vi: '5 inch (3R)',
    }),
    width_mm: 127,
    height_mm: 89,
    dpi: 300,
    width_px: 1500,
    height_px: 1050,
  },
  {
    id: '4R',
    builtin: true,
    alias: '6 寸',
    name: i18n('6 寸 (4R)', '6 吋 (4R)', '6-inch (4R)', {
      ja: '6インチ (4R)',
      ko: '6인치 (4R)',
      es: '6 pulgadas (4R)',
      'pt-BR': '6 polegadas (4R)',
      fr: '6 pouces (4R)',
      de: '6 Zoll (4R)',
      it: '6 pollici (4R)',
      vi: '6 inch (4R)',
    }),
    width_mm: 152,
    height_mm: 102,
    dpi: 300,
    width_px: 1800,
    height_px: 1200,
  },
  {
    id: '5R',
    builtin: true,
    alias: '7 寸',
    name: i18n('7 寸 (5R)', '7 吋 (5R)', '7-inch (5R)', {
      ja: '7インチ (5R)',
      ko: '7인치 (5R)',
      es: '7 pulgadas (5R)',
      'pt-BR': '7 polegadas (5R)',
      fr: '7 pouces (5R)',
      de: '7 Zoll (5R)',
      it: '7 pollici (5R)',
      vi: '7 inch (5R)',
    }),
    width_mm: 178,
    height_mm: 127,
    dpi: 300,
    width_px: 2100,
    height_px: 1500,
  },
  {
    id: '6R',
    builtin: true,
    alias: '8 寸',
    name: i18n('8 寸 (6R)', '8 吋 (6R)', '8-inch (6R)', {
      ja: '8インチ (6R)',
      ko: '8인치 (6R)',
      es: '8 pulgadas (6R)',
      'pt-BR': '8 polegadas (6R)',
      fr: '8 pouces (6R)',
      de: '8 Zoll (6R)',
      it: '8 pollici (6R)',
      vi: '8 inch (6R)',
    }),
    width_mm: 203,
    height_mm: 152,
    dpi: 300,
    width_px: 2400,
    height_px: 1800,
  },
  {
    id: '8R',
    builtin: true,
    alias: '10 寸',
    name: i18n('10 寸 (8R)', '10 吋 (8R)', '10-inch (8R)', {
      ja: '10インチ (8R)',
      ko: '10인치 (8R)',
      es: '10 pulgadas (8R)',
      'pt-BR': '10 polegadas (8R)',
      fr: '10 pouces (8R)',
      de: '10 Zoll (8R)',
      it: '10 pollici (8R)',
      vi: '10 inch (8R)',
    }),
    width_mm: 254,
    height_mm: 203,
    dpi: 300,
    width_px: 3000,
    height_px: 2400,
  },
  {
    id: 'A4',
    builtin: true,
    name: i18n('A4', 'A4', 'A4', {
      ja: 'A4 用紙',
      ko: 'A4 용지',
      es: 'Papel A4',
      'pt-BR': 'Papel A4',
      fr: 'Papier A4',
      de: 'A4-Papier',
      it: 'Carta A4',
      vi: 'Giấy A4',
    }),
    width_mm: 210,
    height_mm: 297,
    dpi: 300,
    width_px: 2480,
    height_px: 3508,
  },
  {
    id: 'A5',
    builtin: true,
    name: i18n('A5', 'A5', 'A5', {
      ja: 'A5 用紙',
      ko: 'A5 용지',
      es: 'Papel A5',
      'pt-BR': 'Papel A5',
      fr: 'Papier A5',
      de: 'A5-Papier',
      it: 'Carta A5',
      vi: 'Giấy A5',
    }),
    width_mm: 148,
    height_mm: 210,
    dpi: 300,
    width_px: 1748,
    height_px: 2480,
  },
]

export function getPaperSpec(id: string): PaperSpec | null {
  return BUILTIN_PAPER_SPECS.find((p) => p.id === id) ?? null
}

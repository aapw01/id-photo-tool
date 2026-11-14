/**
 * Built-in LayoutTemplate library — first edition.
 *
 * Twelve canonical templates spanning the most common print-shop
 * scenarios in PRD §5.6.2:
 *
 *   - 5R (7-inch) paper:
 *       · 8 × 1-inch
 *       · 9 × Chinese ID card
 *       · 4 × Chinese passport
 *       · 4 × Large 2-inch
 *       · 4 × 1-inch + 2 × 2-inch (Mix A)
 *       · 2 × Small wallet
 *   - 6R (8-inch) paper:
 *       · 16 × 1-inch
 *       · 8 × 2-inch
 *       · 8 × 1-inch + 2 × 2-inch (Mix B)
 *       · 6 × 1-inch + 4 × 2-inch (Mix C)
 *       · 2 × Large wallet
 *   - A4: catch-all auto-grid that maximises the chosen spec.
 *
 * Each template is `auto-grid`-arranged; the runtime packer
 * (`features/layout/auto-grid.ts` + `pack-mixed.ts`) calls
 * `gridCells` to materialise the actual coordinates.
 */

import type { I18nText, LayoutTemplate } from '@/types/spec'

/**
 * Locales added in the 8-locale expansion. Template names are short
 * formulas like `5R · 8 × 1-inch` — the only translatable bits are
 * the unit noun ("1-inch" → "1 pollice" / "1 인치") and the document
 * surface keywords ("Passport", "ID card", "wallet").
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

export const BUILTIN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  /* --- 5R --------------------------------------------------------- */
  {
    id: '8x1inch-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 8 张 1 寸', '5R · 8 張 1 吋', '5R · 8 × 1-inch', {
      ja: '5R · 1インチ × 8',
      ko: '5R · 1인치 × 8',
      es: '5R · 8 × 1 pulgada',
      'pt-BR': '5R · 8 × 1 polegada',
      fr: '5R · 8 × 1 pouce',
      de: '5R · 8 × 1 Zoll',
      it: '5R · 8 × 1 pollice',
      vi: '5R · 8 × 1 inch',
    }),
    items: [{ photoSpecId: 'cn-1inch', count: 8 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '9xid-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 9 张身份证照', '5R · 9 張身分證照', '5R · 9 × China ID card', {
      ja: '5R · 中国身分証 × 9',
      ko: '5R · 중국 신분증 × 9',
      es: '5R · 9 × DNI chino',
      'pt-BR': '5R · 9 × RG chinês',
      fr: "5R · 9 × Carte d'identité chinoise",
      de: '5R · 9 × CN-Personalausweis',
      it: "5R · 9 × Carta d'identità cinese",
      vi: '5R · 9 × CMND Trung Quốc',
    }),
    items: [{ photoSpecId: 'cn-id-card', count: 9 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '4xpassport-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 4 张护照照', '5R · 4 張護照照', '5R · 4 × Passport', {
      ja: '5R · パスポート × 4',
      ko: '5R · 여권 × 4',
      es: '5R · 4 × Pasaporte',
      'pt-BR': '5R · 4 × Passaporte',
      fr: '5R · 4 × Passeport',
      de: '5R · 4 × Reisepass',
      it: '5R · 4 × Passaporto',
      vi: '5R · 4 × Hộ chiếu',
    }),
    items: [{ photoSpecId: 'cn-passport', count: 4 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },
  {
    id: '4xlarge2inch-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 4 张大 2 寸', '5R · 4 張大 2 吋', '5R · 4 × Large 2-inch', {
      ja: '5R · 大 2インチ × 4',
      ko: '5R · 대형 2인치 × 4',
      es: '5R · 4 × 2 pulgadas grande',
      'pt-BR': '5R · 4 × 2 polegadas grande',
      fr: '5R · 4 × Grand 2 pouces',
      de: '5R · 4 × Groß 2 Zoll',
      it: '5R · 4 × 2 pollici grande',
      vi: '5R · 4 × 2 inch lớn',
    }),
    items: [{ photoSpecId: 'cn-2inch-large', count: 4 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: false },
  },
  {
    id: 'mix-1inch-2inch-A-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n(
      '5R · 1 寸 + 2 寸混排 (A)',
      '5R · 1 吋 + 2 吋混排 (A)',
      '5R · 1-inch + 2-inch (Mix A)',
      {
        ja: '5R · 1インチ + 2インチ混在 (A)',
        ko: '5R · 1인치 + 2인치 혼합 (A)',
        es: '5R · 1 pulgada + 2 pulgadas (Mix A)',
        'pt-BR': '5R · 1 polegada + 2 polegadas (Mix A)',
        fr: '5R · 1 pouce + 2 pouces (Mix A)',
        de: '5R · 1 Zoll + 2 Zoll (Mix A)',
        it: '5R · 1 pollice + 2 pollici (Mix A)',
        vi: '5R · 1 inch + 2 inch (Mix A)',
      },
    ),
    items: [
      { photoSpecId: 'cn-2inch', count: 2 },
      { photoSpecId: 'cn-1inch', count: 4 },
    ],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '2xwallet-small-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 2 张小皮夹照', '5R · 2 張小皮夾照', '5R · 2 × Small wallet', {
      ja: '5R · 小ウォレット × 2',
      ko: '5R · 소형 지갑 × 2',
      es: '5R · 2 × Cartera pequeña',
      'pt-BR': '5R · 2 × Carteira pequena',
      fr: '5R · 2 × Petit portefeuille',
      de: '5R · 2 × Brieftasche klein',
      it: '5R · 2 × Portafoglio piccolo',
      vi: '5R · 2 × Ảnh ví nhỏ',
    }),
    items: [{ photoSpecId: 'cn-wallet-small', count: 2 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },

  /* --- 6R --------------------------------------------------------- */
  {
    id: '16x1inch-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n('6R · 16 张 1 寸', '6R · 16 張 1 吋', '6R · 16 × 1-inch', {
      ja: '6R · 1インチ × 16',
      ko: '6R · 1인치 × 16',
      es: '6R · 16 × 1 pulgada',
      'pt-BR': '6R · 16 × 1 polegada',
      fr: '6R · 16 × 1 pouce',
      de: '6R · 16 × 1 Zoll',
      it: '6R · 16 × 1 pollice',
      vi: '6R · 16 × 1 inch',
    }),
    items: [{ photoSpecId: 'cn-1inch', count: 16 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '8x2inch-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n('6R · 8 张 2 寸', '6R · 8 張 2 吋', '6R · 8 × 2-inch', {
      ja: '6R · 2インチ × 8',
      ko: '6R · 2인치 × 8',
      es: '6R · 8 × 2 pulgadas',
      'pt-BR': '6R · 8 × 2 polegadas',
      fr: '6R · 8 × 2 pouces',
      de: '6R · 8 × 2 Zoll',
      it: '6R · 8 × 2 pollici',
      vi: '6R · 8 × 2 inch',
    }),
    items: [{ photoSpecId: 'cn-2inch', count: 8 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: false },
  },
  {
    id: 'mix-1inch-2inch-B-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n(
      '6R · 1 寸 + 2 寸混排 (B)',
      '6R · 1 吋 + 2 吋混排 (B)',
      '6R · 1-inch + 2-inch (Mix B)',
      {
        ja: '6R · 1インチ + 2インチ混在 (B)',
        ko: '6R · 1인치 + 2인치 혼합 (B)',
        es: '6R · 1 pulgada + 2 pulgadas (Mix B)',
        'pt-BR': '6R · 1 polegada + 2 polegadas (Mix B)',
        fr: '6R · 1 pouce + 2 pouces (Mix B)',
        de: '6R · 1 Zoll + 2 Zoll (Mix B)',
        it: '6R · 1 pollice + 2 pollici (Mix B)',
        vi: '6R · 1 inch + 2 inch (Mix B)',
      },
    ),
    items: [
      { photoSpecId: 'cn-2inch', count: 2 },
      { photoSpecId: 'cn-1inch', count: 8 },
    ],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: 'mix-1inch-2inch-C-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n(
      '6R · 1 寸 + 2 寸混排 (C)',
      '6R · 1 吋 + 2 吋混排 (C)',
      '6R · 1-inch + 2-inch (Mix C)',
      {
        ja: '6R · 1インチ + 2インチ混在 (C)',
        ko: '6R · 1인치 + 2인치 혼합 (C)',
        es: '6R · 1 pulgada + 2 pulgadas (Mix C)',
        'pt-BR': '6R · 1 polegada + 2 polegadas (Mix C)',
        fr: '6R · 1 pouce + 2 pouces (Mix C)',
        de: '6R · 1 Zoll + 2 Zoll (Mix C)',
        it: '6R · 1 pollice + 2 pollici (Mix C)',
        vi: '6R · 1 inch + 2 inch (Mix C)',
      },
    ),
    items: [
      { photoSpecId: 'cn-2inch', count: 4 },
      { photoSpecId: 'cn-1inch', count: 6 },
    ],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '2xwallet-large-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n('6R · 2 张大皮夹照', '6R · 2 張大皮夾照', '6R · 2 × Large wallet', {
      ja: '6R · 大ウォレット × 2',
      ko: '6R · 대형 지갑 × 2',
      es: '6R · 2 × Cartera grande',
      'pt-BR': '6R · 2 × Carteira grande',
      fr: '6R · 2 × Grand portefeuille',
      de: '6R · 2 × Brieftasche groß',
      it: '6R · 2 × Portafoglio grande',
      vi: '6R · 2 × Ảnh ví lớn',
    }),
    items: [{ photoSpecId: 'cn-wallet-large', count: 2 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },

  /* --- A4 fallback ------------------------------------------------ */
  {
    id: 'a4-fill-1inch',
    builtin: true,
    paperId: 'A4',
    name: i18n('A4 · 1 寸最大化', 'A4 · 1 吋最大化', 'A4 · max 1-inch', {
      ja: 'A4 · 1インチ最大化',
      ko: 'A4 · 1인치 최대',
      es: 'A4 · 1 pulgada máx.',
      'pt-BR': 'A4 · 1 polegada máx.',
      fr: 'A4 · 1 pouce max.',
      de: 'A4 · 1 Zoll Max',
      it: 'A4 · 1 pollice max.',
      vi: 'A4 · 1 inch tối đa',
    }),
    // Generous count; the auto-grid packer caps at what physically fits.
    items: [{ photoSpecId: 'cn-1inch', count: 100 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
]

/** Lookup by id. Null when unknown so callers can render a fallback. */
export function getLayoutTemplate(id: string): LayoutTemplate | null {
  return BUILTIN_LAYOUT_TEMPLATES.find((t) => t.id === id) ?? null
}

/** Filter templates by paper id — drives the layout picker. */
export function getLayoutTemplatesForPaper(paperId: string): LayoutTemplate[] {
  return BUILTIN_LAYOUT_TEMPLATES.filter((t) => t.paperId === paperId)
}

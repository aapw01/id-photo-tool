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

import type { LayoutTemplate } from '@/types/spec'

const i18n = (zh: string, zhHant: string, en: string) => ({ zh, 'zh-Hant': zhHant, en })

export const BUILTIN_LAYOUT_TEMPLATES: LayoutTemplate[] = [
  /* --- 5R --------------------------------------------------------- */
  {
    id: '8x1inch-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 8 张 1 寸', '5R · 8 張 1 吋', '5R · 8 × 1-inch'),
    items: [{ photoSpecId: 'cn-1inch', count: 8 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '9xid-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 9 张身份证照', '5R · 9 張身分證照', '5R · 9 × China ID card'),
    items: [{ photoSpecId: 'cn-id-card', count: 9 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '4xpassport-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 4 张护照照', '5R · 4 張護照照', '5R · 4 × Passport'),
    items: [{ photoSpecId: 'cn-passport', count: 4 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },
  {
    id: '4xlarge2inch-on-5R',
    builtin: true,
    paperId: '5R',
    name: i18n('5R · 4 张大 2 寸', '5R · 4 張大 2 吋', '5R · 4 × Large 2-inch'),
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
    name: i18n('5R · 2 张小皮夹照', '5R · 2 張小皮夾照', '5R · 2 × Small wallet'),
    items: [{ photoSpecId: 'cn-wallet-small', count: 2 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },

  /* --- 6R --------------------------------------------------------- */
  {
    id: '16x1inch-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n('6R · 16 张 1 寸', '6R · 16 張 1 吋', '6R · 16 × 1-inch'),
    items: [{ photoSpecId: 'cn-1inch', count: 16 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 2, showSeparator: true, showCutGuides: false },
  },
  {
    id: '8x2inch-on-6R',
    builtin: true,
    paperId: '6R',
    name: i18n('6R · 8 张 2 寸', '6R · 8 張 2 吋', '6R · 8 × 2-inch'),
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
    name: i18n('6R · 2 张大皮夹照', '6R · 2 張大皮夾照', '6R · 2 × Large wallet'),
    items: [{ photoSpecId: 'cn-wallet-large', count: 2 }],
    arrangement: { kind: 'auto-grid' },
    settings: { margin_mm: 5, gap_mm: 3, showSeparator: true, showCutGuides: true },
  },

  /* --- A4 fallback ------------------------------------------------ */
  {
    id: 'a4-fill-1inch',
    builtin: true,
    paperId: 'A4',
    name: i18n('A4 · 1 寸最大化', 'A4 · 1 吋最大化', 'A4 · max 1-inch'),
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

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

import type { PaperSpec } from '@/types/spec'

const i18n = (zh: string, zhHant: string, en: string) => ({ zh, 'zh-Hant': zhHant, en })

export const BUILTIN_PAPER_SPECS: PaperSpec[] = [
  {
    id: '3R',
    builtin: true,
    alias: '5 寸',
    name: i18n('5 寸 (3R)', '5 吋 (3R)', '5-inch (3R)'),
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
    name: i18n('6 寸 (4R)', '6 吋 (4R)', '6-inch (4R)'),
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
    name: i18n('7 寸 (5R)', '7 吋 (5R)', '7-inch (5R)'),
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
    name: i18n('8 寸 (6R)', '8 吋 (6R)', '8-inch (6R)'),
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
    name: i18n('10 寸 (8R)', '10 吋 (8R)', '10-inch (8R)'),
    width_mm: 254,
    height_mm: 203,
    dpi: 300,
    width_px: 3000,
    height_px: 2400,
  },
  {
    id: 'A4',
    builtin: true,
    name: i18n('A4', 'A4', 'A4'),
    width_mm: 210,
    height_mm: 297,
    dpi: 300,
    width_px: 2480,
    height_px: 3508,
  },
  {
    id: 'A5',
    builtin: true,
    name: i18n('A5', 'A5', 'A5'),
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

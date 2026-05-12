import { describe, expect, it } from 'vitest'

import { buildFilename, formatDate } from './filename'
import type { PhotoSpec } from '@/types/spec'

const usVisa: PhotoSpec = {
  id: 'us-visa',
  builtin: true,
  category: 'visa',
  name: { zh: '美国签证', 'zh-Hant': '美國簽證', en: 'US visa' },
  width_mm: 51,
  height_mm: 51,
  dpi: 300,
  width_px: 600,
  height_px: 600,
  background: { recommended: '#FFFFFF' },
}

const fixedDate = new Date(2026, 4, 12)

describe('buildFilename', () => {
  describe('kind=single', () => {
    it('uses spec id + derived px + ext', () => {
      expect(
        buildFilename({ kind: 'single', spec: usVisa, ext: 'png', date: fixedDate }),
      ).toMatchInlineSnapshot(`"us-visa_600x600_20260512.png"`)
    })

    it('falls back to "pixfit" when no spec is set', () => {
      expect(
        buildFilename({
          kind: 'single',
          spec: null,
          ext: 'jpg',
          width: 1024,
          height: 768,
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"pixfit_1024x768_20260512.jpg"`)
    })

    it('honours width/height overrides over spec dimensions', () => {
      expect(
        buildFilename({
          kind: 'single',
          spec: usVisa,
          ext: 'webp',
          width: 500,
          height: 500,
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"us-visa_500x500_20260512.webp"`)
    })
  })

  describe('kind=compressed', () => {
    it('inserts the target KB segment before the date', () => {
      expect(
        buildFilename({
          kind: 'compressed',
          spec: usVisa,
          ext: 'jpg',
          targetKB: 25,
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"us-visa_600x600_25KB_20260512.jpg"`)
    })

    it('keeps the prefix logic when spec is null', () => {
      expect(
        buildFilename({
          kind: 'compressed',
          spec: null,
          ext: 'jpg',
          targetKB: 50,
          width: 800,
          height: 600,
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"pixfit_800x600_50KB_20260512.jpg"`)
    })
  })

  describe('kind=layout', () => {
    it('formats `layout_{template}_{paper}_{date}.{ext}`', () => {
      expect(
        buildFilename({
          kind: 'layout',
          templateId: '8x1inch-on-5R',
          paperId: '5R',
          ext: 'pdf',
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"layout_8x1inch-on-5R_5R_20260512.pdf"`)
    })

    it('sanitises ids that contain unfriendly chars', () => {
      expect(
        buildFilename({
          kind: 'layout',
          templateId: 'my custom layout 1+',
          paperId: 'paper id',
          ext: 'png',
          date: fixedDate,
        }),
      ).toMatchInlineSnapshot(`"layout_my_custom_layout_1__paper_id_20260512.png"`)
    })
  })

  describe('formatDate', () => {
    it('pads single-digit months and days', () => {
      expect(formatDate(new Date(2026, 0, 1))).toBe('20260101')
    })

    it('emits YYYYMMDD even for late dates', () => {
      expect(formatDate(new Date(2030, 11, 31))).toBe('20301231')
    })
  })
})

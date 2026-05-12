import { describe, expect, it } from 'vitest'

import {
  exportFilename,
  exportToJSON,
  formatExportDate,
  parseSpecsJson,
  specsToJsonString,
} from './import-export'
import { makeEmptySpecsV1, type SpecsV1 } from './schema'

const SAMPLE: SpecsV1 = {
  version: 1,
  photoSpecs: [
    {
      id: 'custom-1',
      builtin: false,
      category: 'custom',
      name: { zh: '名片', 'zh-Hant': '名片', en: 'Card' },
      width_mm: 35,
      height_mm: 45,
      dpi: 300,
    },
  ],
  paperSpecs: [],
  layoutTemplates: [],
}

describe('formatExportDate / exportFilename', () => {
  it('formats YYYYMMDD with zero-padded month + day', () => {
    expect(formatExportDate(new Date(Date.UTC(2026, 0, 3)))).toMatch(/^2026\d{2}\d{2}$/)
  })

  it('uses the pixfit-specs-YYYYMMDD.json convention', () => {
    expect(exportFilename(new Date(Date.UTC(2026, 4, 12)))).toMatch(
      /^pixfit-specs-\d{8}\.json$/,
    )
  })
})

describe('specsToJsonString / exportToJSON', () => {
  it('round-trips through JSON.parse', () => {
    const json = specsToJsonString(SAMPLE)
    expect(JSON.parse(json)).toEqual(SAMPLE)
  })

  it('returns a Blob with the JSON mime type', () => {
    const blob = exportToJSON(SAMPLE)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
  })
})

describe('parseSpecsJson', () => {
  it('accepts the canonical empty payload', () => {
    const out = parseSpecsJson(JSON.stringify(makeEmptySpecsV1()))
    expect(out.ok).toBe(true)
  })

  it('rejects empty input', () => {
    const out = parseSpecsJson('   ')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('empty-input')
  })

  it('rejects malformed JSON', () => {
    const out = parseSpecsJson('{not-json')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('invalid-json')
  })

  it('rejects unsupported version', () => {
    const out = parseSpecsJson(
      JSON.stringify({ version: 99, photoSpecs: [], paperSpecs: [], layoutTemplates: [] }),
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('unsupported-version')
  })

  it('rejects payloads with the wrong photoSpec shape', () => {
    const out = parseSpecsJson(
      JSON.stringify({
        version: 1,
        photoSpecs: [{ id: 'broken' }],
        paperSpecs: [],
        layoutTemplates: [],
      }),
    )
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.code).toBe('invalid-schema')
      expect(out.issues?.length).toBeGreaterThan(0)
    }
  })

  it('accepts a payload that round-trips from exportToJSON', async () => {
    const blob = exportToJSON(SAMPLE)
    const text = await blob.text()
    const out = parseSpecsJson(text)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value).toEqual(SAMPLE)
  })
})

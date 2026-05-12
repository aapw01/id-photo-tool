// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSpecs, loadSpecs, saveSpecs } from './storage'
import { SPECS_STORAGE_KEY, makeEmptySpecsV1, type SpecsV1 } from './schema'

const VALID_PAYLOAD: SpecsV1 = {
  version: 1,
  photoSpecs: [
    {
      id: 'custom-1',
      builtin: false,
      category: 'custom',
      name: { zh: '自定义', 'zh-Hant': '自訂', en: 'Custom' },
      width_mm: 35,
      height_mm: 45,
      dpi: 300,
    },
  ],
  paperSpecs: [],
  layoutTemplates: [],
}

describe('spec-manager/storage', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })
  afterEach(() => {
    globalThis.localStorage?.clear()
  })

  it('returns an empty v1 record when localStorage is empty', () => {
    expect(loadSpecs()).toEqual(makeEmptySpecsV1())
  })

  it('round-trips a valid payload', () => {
    expect(saveSpecs(VALID_PAYLOAD)).toBe(true)
    expect(loadSpecs()).toEqual(VALID_PAYLOAD)
  })

  it('falls back to empty when JSON is corrupt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    globalThis.localStorage?.setItem(SPECS_STORAGE_KEY, '{not-json')
    expect(loadSpecs()).toEqual(makeEmptySpecsV1())
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back to empty when version is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    globalThis.localStorage?.setItem(
      SPECS_STORAGE_KEY,
      JSON.stringify({ version: 2, photoSpecs: [], paperSpecs: [], layoutTemplates: [] }),
    )
    expect(loadSpecs()).toEqual(makeEmptySpecsV1())
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back to empty when payload has wrong shape', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    globalThis.localStorage?.setItem(
      SPECS_STORAGE_KEY,
      JSON.stringify({ version: 1, photoSpecs: 'definitely-not-an-array' }),
    )
    expect(loadSpecs()).toEqual(makeEmptySpecsV1())
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('refuses to persist an invalid payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(
      saveSpecs({
        version: 1,
        photoSpecs: [
          {
            // missing required fields like name + dpi
            id: 'bad',
            builtin: false,
            category: 'custom',
            width_mm: 35,
            height_mm: 45,
          },
        ],
        paperSpecs: [],
        layoutTemplates: [],
      } as unknown as SpecsV1),
    ).toBe(false)
    expect(globalThis.localStorage?.getItem(SPECS_STORAGE_KEY)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('clearSpecs removes the key', () => {
    saveSpecs(VALID_PAYLOAD)
    expect(globalThis.localStorage?.getItem(SPECS_STORAGE_KEY)).not.toBeNull()
    clearSpecs()
    expect(globalThis.localStorage?.getItem(SPECS_STORAGE_KEY)).toBeNull()
  })
})

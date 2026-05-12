// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  __resetSpecManagerStoreForTesting,
  BUILTIN_PHOTO_SPECS,
  useSpecManagerStore,
} from './store'
import { SPECS_STORAGE_KEY } from './schema'
import type { PhotoSpec } from '@/types/spec'

const candidate: PhotoSpec = {
  id: 'my-card',
  builtin: false,
  category: 'custom',
  name: { zh: '名片', 'zh-Hant': '名片', en: 'Card' },
  width_mm: 35,
  height_mm: 45,
  dpi: 300,
}

describe('useSpecManagerStore', () => {
  beforeEach(() => {
    __resetSpecManagerStoreForTesting()
  })
  afterEach(() => {
    __resetSpecManagerStoreForTesting()
  })

  it('starts empty before rehydrate', () => {
    const state = useSpecManagerStore.getState()
    expect(state.hydrated).toBe(false)
    expect(state.customPhotoSpecs).toEqual([])
  })

  it('rehydrates from localStorage', () => {
    globalThis.localStorage?.setItem(
      SPECS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        photoSpecs: [candidate],
        paperSpecs: [],
        layoutTemplates: [],
      }),
    )
    useSpecManagerStore.getState().rehydrate()
    const state = useSpecManagerStore.getState()
    expect(state.hydrated).toBe(true)
    expect(state.customPhotoSpecs).toEqual([candidate])
  })

  it('creates and persists a custom photo spec', () => {
    const result = useSpecManagerStore.getState().createPhoto(candidate)
    expect(result.ok).toBe(true)
    expect(useSpecManagerStore.getState().customPhotoSpecs).toEqual([candidate])
    const raw = globalThis.localStorage?.getItem(SPECS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '{}').photoSpecs).toEqual([candidate])
  })

  it('refuses to delete builtin entries via the store', () => {
    // Inject a builtin into customPhotoSpecs to simulate misuse.
    useSpecManagerStore.setState({
      customPhotoSpecs: [{ ...candidate, builtin: true }],
    })
    const out = useSpecManagerStore.getState().deletePhoto('my-card')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('builtin-protected')
  })

  it('replaceAll overwrites the entire user-spec snapshot', () => {
    useSpecManagerStore.getState().createPhoto(candidate)
    useSpecManagerStore.getState().replaceAll({
      version: 1,
      photoSpecs: [],
      paperSpecs: [],
      layoutTemplates: [],
    })
    expect(useSpecManagerStore.getState().customPhotoSpecs).toEqual([])
  })

  it('BUILTIN_PHOTO_SPECS is non-empty', () => {
    expect(BUILTIN_PHOTO_SPECS.length).toBeGreaterThan(0)
  })
})

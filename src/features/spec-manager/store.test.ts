// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { renderHook } from '@testing-library/react'

import {
  __resetSpecManagerStoreForTesting,
  BUILTIN_PHOTO_SPECS,
  useEffectiveLayoutTemplates,
  useEffectivePhotoSpecs,
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

  it('useEffectiveLayoutTemplates exposes the built-in template library', () => {
    // Regression: an empty-array shadow used to mask the real BUILTIN_LAYOUT_TEMPLATES
    // and silently hid every default layout from the studio.
    const { result } = renderHook(() => useEffectiveLayoutTemplates())
    expect(result.current.length).toBeGreaterThanOrEqual(12)
  })

  it('useEffectivePhotoSpecs surfaces user-saved specs alongside builtins', () => {
    // Regression: before C1 the studio's SpecPicker imported
    // BUILTIN_PHOTO_SPECS directly so customs created via `/specs`
    // never appeared in the main flow.
    const out = useSpecManagerStore.getState().createPhoto(candidate)
    expect(out.ok).toBe(true)

    const { result } = renderHook(() => useEffectivePhotoSpecs())
    expect(result.current.some((s) => s.id === candidate.id)).toBe(true)
    expect(result.current.length).toBeGreaterThan(BUILTIN_PHOTO_SPECS.length)
  })

  it('useEffectivePhotoSpecs returns a stable reference across renders', () => {
    // Regression: the layout tab hung the page because this hook used
    // to call `mergePhotoSpecs(...)` on every render, handing out a new
    // array identity each time. Effects with `effectiveSpecs` in their
    // dep array then ran every commit, called setState, re-rendered,
    // and looped forever. Memoising on the user-customs reference is
    // the contract that keeps downstream effects honest.
    const { result, rerender } = renderHook(() => useEffectivePhotoSpecs())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

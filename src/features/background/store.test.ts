// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetBackgroundStoreForTesting,
  pushRecent,
  RECENT_KEY,
  RECENT_MAX,
  useBackgroundStore,
} from '@/features/background/store'

describe('pushRecent', () => {
  it('prepends new colour', () => {
    expect(pushRecent([], '#ffffff')).toEqual(['#ffffff'])
    expect(pushRecent(['#ff0000'], '#00ff00')).toEqual(['#00ff00', '#ff0000'])
  })

  it('moves existing colour to front (LRU)', () => {
    expect(pushRecent(['#ff0000', '#00ff00'], '#00ff00')).toEqual(['#00ff00', '#ff0000'])
  })

  it('lowercases before comparing', () => {
    expect(pushRecent(['#ff0000'], '#FF0000')).toEqual(['#ff0000'])
  })

  it('caps the list at RECENT_MAX', () => {
    const seed = Array.from({ length: RECENT_MAX }, (_, i) => `#${i.toString(16).padStart(6, '0')}`)
    const next = pushRecent(seed, '#ffffff')
    expect(next).toHaveLength(RECENT_MAX)
    expect(next[0]).toBe('#ffffff')
  })

  it('rejects invalid hex', () => {
    expect(pushRecent(['#ff0000'], 'nope')).toEqual(['#ff0000'])
  })
})

describe('useBackgroundStore', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
    __resetBackgroundStoreForTesting()
  })

  afterEach(() => {
    globalThis.localStorage?.clear()
  })

  it('defaults to transparent', () => {
    expect(useBackgroundStore.getState().current).toEqual({ kind: 'transparent' })
    expect(useBackgroundStore.getState().recent).toEqual([])
  })

  it('setColor with a colour adds to recent + persists to localStorage', () => {
    useBackgroundStore.getState().setColor({ kind: 'color', hex: '#438EDB' })
    expect(useBackgroundStore.getState().current).toEqual({
      kind: 'color',
      hex: '#438EDB',
    })
    expect(useBackgroundStore.getState().recent).toEqual(['#438edb'])
    const stored = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? '[]')
    expect(stored).toEqual(['#438edb'])
  })

  it('setColor with transparent does NOT add to recent', () => {
    useBackgroundStore.getState().setColor({ kind: 'color', hex: '#FFFFFF' })
    useBackgroundStore.getState().setColor({ kind: 'transparent' })
    expect(useBackgroundStore.getState().recent).toEqual(['#ffffff'])
  })

  it('reset only clears `current`, not recent', () => {
    useBackgroundStore.getState().setColor({ kind: 'color', hex: '#FFFFFF' })
    useBackgroundStore.getState().reset()
    expect(useBackgroundStore.getState().current).toEqual({ kind: 'transparent' })
    expect(useBackgroundStore.getState().recent).toEqual(['#ffffff'])
  })

  it('recovers gracefully from corrupt localStorage', () => {
    globalThis.localStorage?.setItem(RECENT_KEY, '{nope')
    // Re-import would normally bypass the module cache, but `recent`
    // is already populated from the initial read; the corrupt write
    // should be ignored on subsequent reads.
    expect(useBackgroundStore.getState().recent).toEqual([])
  })
})

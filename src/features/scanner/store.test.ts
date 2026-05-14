import { describe, expect, it, beforeEach } from 'vitest'

import { MAX_CORNER_RADIUS_PX, useScannerStore } from './store'

/**
 * Store-level regression tests for the optional watermark.
 *
 * The full render / rectify pipeline is exercised by the kernel tests
 * (render-modes.test.ts, pack-a4.test.ts, watermark.test.ts). Here we
 * just need to assert the public store contract:
 *
 *   1. The initial state has watermark.enabled === false (the product
 *      decision — watermark is opt-in).
 *   2. `setWatermarkEnabled` flips the boolean idempotently (dedup
 *      early-return mirrors the other watermark setters).
 *   3. The other watermark setters leave `enabled` untouched.
 */
describe('useScannerStore — watermark default + toggle', () => {
  beforeEach(() => {
    // Each test starts from a fresh store snapshot. We can't recreate
    // the store, but `reset()` rewinds it to the same INITIAL block
    // the file ships with.
    useScannerStore.getState().reset()
  })

  it('defaults to watermark.enabled === false (opt-in)', () => {
    expect(useScannerStore.getState().watermark.enabled).toBe(false)
  })

  it('setWatermarkEnabled(true) flips the toggle on', () => {
    useScannerStore.getState().setWatermarkEnabled(true)
    expect(useScannerStore.getState().watermark.enabled).toBe(true)
  })

  it('setWatermarkEnabled is idempotent when given the current value', () => {
    const ref1 = useScannerStore.getState().watermark
    useScannerStore.getState().setWatermarkEnabled(false)
    const ref2 = useScannerStore.getState().watermark
    // Same object identity — the dedup short-circuit fired.
    expect(ref2).toBe(ref1)
  })

  it('toggling enabled preserves text / opacity / density', () => {
    const store = useScannerStore.getState()
    store.setWatermarkText('Sample')
    store.setWatermarkOpacity(0.5)
    store.setWatermarkDensity('dense')
    store.setWatermarkEnabled(true)
    const wm = useScannerStore.getState().watermark
    expect(wm.enabled).toBe(true)
    expect(wm.text).toBe('Sample')
    expect(wm.opacity).toBe(0.5)
    expect(wm.density).toBe('dense')
  })

  it('text / opacity / density setters do not silently flip enabled on', () => {
    useScannerStore.getState().setWatermarkText('Sample')
    useScannerStore.getState().setWatermarkOpacity(0.6)
    useScannerStore.getState().setWatermarkDensity('sparse')
    expect(useScannerStore.getState().watermark.enabled).toBe(false)
  })
})

/**
 * Rounded-corner radius is also an opt-in product knob (default off /
 * 0 px). It needs to round-trip through the store, dedup on no-op, and
 * clamp to [0, MAX_CORNER_RADIUS_PX] regardless of what the UI feeds.
 */
describe('useScannerStore — corner radius', () => {
  beforeEach(() => {
    useScannerStore.getState().reset()
  })

  it('defaults to cornerRadiusPx === 0 (off)', () => {
    expect(useScannerStore.getState().cornerRadiusPx).toBe(0)
  })

  it('setCornerRadiusPx accepts mid-range values verbatim', () => {
    useScannerStore.getState().setCornerRadiusPx(24)
    expect(useScannerStore.getState().cornerRadiusPx).toBe(24)
  })

  it('clamps below 0 to 0 and above MAX to MAX', () => {
    useScannerStore.getState().setCornerRadiusPx(-100)
    expect(useScannerStore.getState().cornerRadiusPx).toBe(0)
    useScannerStore.getState().setCornerRadiusPx(9999)
    expect(useScannerStore.getState().cornerRadiusPx).toBe(MAX_CORNER_RADIUS_PX)
  })

  it('rounds fractional input', () => {
    useScannerStore.getState().setCornerRadiusPx(12.6)
    expect(useScannerStore.getState().cornerRadiusPx).toBe(13)
  })

  it('reset() returns cornerRadiusPx to 0', () => {
    useScannerStore.getState().setCornerRadiusPx(40)
    useScannerStore.getState().reset()
    expect(useScannerStore.getState().cornerRadiusPx).toBe(0)
  })
})

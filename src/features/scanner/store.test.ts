import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { computePreviewSignature, MAX_CORNER_RADIUS_PX, useScannerStore } from './store'
import type { ScannerSlot } from './store'

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

/**
 * Preview slice tests — `regeneratePreview` is the heart of the new
 * "preview before download" dialog. The contract under test:
 *
 *   1. The preview always reflects the current settings — paper size,
 *      watermark, corner radius. Changing any input must invalidate
 *      the cached blob via the signature.
 *   2. Each replacement revokes the previous object URL exactly once,
 *      and `reset()` / `clearPreview()` revoke too. Leaking blob URLs
 *      eats memory across long scanner sessions.
 *   3. With no rectified sides the call resolves to `null` and drops
 *      any stale cache (signature-mismatch invalidation in reverse).
 *
 * We stub `URL.createObjectURL` and `URL.revokeObjectURL` so we can
 * track every issued URL and assert the revoke pattern. The actual
 * `packCurrentSides` pipeline is mocked at the module boundary
 * (`./lib/pack-a4`) so the test does not depend on the canvas /
 * watermark / pdf integration — those are exercised by their own
 * kernel suites.
 */
describe('useScannerStore — preview slice', () => {
  // Track issued vs revoked object URLs so we can assert the
  // revoke-on-replace contract without depending on real URL impl.
  const issued: string[] = []
  const revoked: string[] = []
  let urlCounter = 0
  let createSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useScannerStore.getState().reset()
    issued.length = 0
    revoked.length = 0
    urlCounter = 0
    createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test-${++urlCounter}`
      issued.push(url)
      return url
    })
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url)
    })
  })

  afterEach(() => {
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })

  /**
   * Build a minimally-populated `ScannerSlot` with a synthetic
   * rectified blob. Real fields like `bitmap` are filled with a stub
   * value — `packCurrentSides` only reads `rectified.blob`, the rest
   * is opaque to the preview pipeline. We bypass the public setters
   * because they kick off async rectify pipelines we don't want in
   * a unit test.
   */
  function installFrontSlot(blob: Blob): void {
    const slot: ScannerSlot = {
      file: new File([blob], 'test.png', { type: 'image/png' }),
      bitmap: {} as unknown as ImageBitmap,
      blob,
      convertedFromHeic: false,
      convertedFromPdf: false,
      sourcePageCount: undefined,
      rectified: {
        blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
        quad: {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 100, y: 0 },
          bottomRight: { x: 100, y: 100 },
          bottomLeft: { x: 0, y: 100 },
        },
        width: 100,
        height: 100,
        userAdjusted: false,
      },
      rectifyState: 'ready',
      rectifyError: null,
      rendered: null,
      renderState: 'idle',
    }
    useScannerStore.setState({ front: slot })
  }

  it('signature mirrors paper size / watermark / corner radius / blob identity', () => {
    const s0 = useScannerStore.getState()
    const sig0 = computePreviewSignature(s0)

    useScannerStore.getState().setPaperSize('letter')
    expect(computePreviewSignature(useScannerStore.getState())).not.toBe(sig0)

    useScannerStore.getState().setPaperSize('a4')
    const sig1 = computePreviewSignature(useScannerStore.getState())
    expect(sig1).toBe(sig0)

    useScannerStore.getState().setCornerRadiusPx(20)
    expect(computePreviewSignature(useScannerStore.getState())).not.toBe(sig1)

    useScannerStore.getState().setCornerRadiusPx(0)
    useScannerStore.getState().setWatermarkEnabled(true)
    expect(computePreviewSignature(useScannerStore.getState())).not.toBe(sig1)
  })

  it('regeneratePreview returns null when no rectified sides are present', async () => {
    const result = await useScannerStore.getState().regeneratePreview()
    expect(result).toBeNull()
    expect(useScannerStore.getState().preview).toBeNull()
    expect(useScannerStore.getState().previewState).toBe('idle')
    expect(issued).toHaveLength(0)
  })

  it('regeneratePreview produces a cached preview when a side is ready', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const result = await useScannerStore.getState().regeneratePreview()
    expect(result).not.toBeNull()
    expect(result?.blob).toBeInstanceOf(Blob)
    expect(result?.objectUrl).toMatch(/^blob:test-/)
    expect(useScannerStore.getState().preview).toEqual(result)
    expect(useScannerStore.getState().previewState).toBe('ready')
    expect(issued).toHaveLength(1)
    expect(revoked).toHaveLength(0)
  })

  it('regeneratePreview is a no-op when nothing changed (cache hit)', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    const second = await useScannerStore.getState().regeneratePreview()
    expect(second).toBe(first)
    expect(issued).toHaveLength(1)
    expect(revoked).toHaveLength(0)
  })

  it('changing paper size invalidates the cached preview and revokes its URL', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    expect(first?.paperSize).toBe('a4')

    useScannerStore.getState().setPaperSize('letter')
    const second = await useScannerStore.getState().regeneratePreview()
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    expect(second?.paperSize).toBe('letter')
    expect(second?.signature).not.toBe(first?.signature)
    // Exactly one revoke for the old URL, one new issue for the new
    // blob. No double-revokes; no stranded URLs.
    expect(issued).toHaveLength(2)
    expect(revoked).toEqual([first?.objectUrl])
  })

  it('toggling the watermark invalidates the preview', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    useScannerStore.getState().setWatermarkEnabled(true)
    const second = await useScannerStore.getState().regeneratePreview()
    expect(second?.signature).not.toBe(first?.signature)
    expect(revoked).toEqual([first?.objectUrl])
  })

  it('changing the corner radius invalidates the preview', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    useScannerStore.getState().setCornerRadiusPx(24)
    const second = await useScannerStore.getState().regeneratePreview()
    expect(second?.signature).not.toBe(first?.signature)
    expect(revoked).toEqual([first?.objectUrl])
  })

  it('clearPreview() revokes the URL and resets the state', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    useScannerStore.getState().clearPreview()
    expect(useScannerStore.getState().preview).toBeNull()
    expect(useScannerStore.getState().previewState).toBe('idle')
    expect(revoked).toEqual([first?.objectUrl])
  })

  it('reset() revokes the cached preview URL', async () => {
    installFrontSlot(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    const first = await useScannerStore.getState().regeneratePreview()
    useScannerStore.getState().reset()
    expect(useScannerStore.getState().preview).toBeNull()
    expect(revoked).toEqual([first?.objectUrl])
  })
})

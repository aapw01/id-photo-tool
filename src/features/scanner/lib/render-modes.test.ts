import { describe, expect, it } from 'vitest'

import { applyMode, renderOutputMode } from './render-modes'
import type { WatermarkConfig } from './watermark'

function makeImageData(pixels: number[]): ImageData {
  // pixels: array of [r, g, b, a, r, g, b, a, ...]
  if (pixels.length % 4 !== 0) {
    throw new Error('pixels must be a multiple of 4 (RGBA)')
  }
  const data = new Uint8ClampedArray(pixels)
  const total = pixels.length / 4
  const width = Math.round(Math.sqrt(total))
  const height = Math.round(total / width)
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

describe('applyMode', () => {
  it('scan: stretches per-channel contrast (auto white balance)', () => {
    // 4 px, all mid-range (no extremes) — the stretch should push
    // them roughly to the corners.
    const img = makeImageData([
      100, 100, 100, 255, 120, 120, 120, 255, 140, 140, 140, 255, 160, 160, 160, 255,
    ])
    applyMode(img, 'scan')
    // Bottom and top should have been remapped to [0, 255].
    expect(img.data[0]).toBe(0)
    expect(img.data[12]).toBe(255)
  })

  it('copy: produces a strictly binary image (0 or 255 per channel)', () => {
    const img = makeImageData([
      0, 0, 0, 255, 80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255,
    ])
    applyMode(img, 'copy')
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i]
      const g = img.data[i + 1]
      const b = img.data[i + 2]
      expect([0, 255]).toContain(r)
      expect([0, 255]).toContain(g)
      expect([0, 255]).toContain(b)
      // Gray inputs must produce equal RGB outputs
      expect(r).toBe(g)
      expect(g).toBe(b)
    }
  })

  it('enhance: amplifies saturation around the mean', () => {
    // Pure red at 50 % intensity — mean = 42, R - mean = 86.
    // After saturation × 1.30, R should brighten and G/B should darken.
    const img = makeImageData([128, 0, 0, 255, 128, 0, 0, 255, 128, 0, 0, 255, 128, 0, 0, 255])
    applyMode(img, 'enhance')
    // R should have moved further toward 255.
    expect(img.data[0]!).toBeGreaterThan(128)
    // G should remain at 0 (already at the floor).
    expect(img.data[1]).toBe(0)
  })

  it('preserves the alpha channel across all modes', () => {
    for (const mode of ['scan', 'copy', 'enhance'] as const) {
      const img = makeImageData([100, 100, 100, 123, 200, 50, 30, 200])
      applyMode(img, mode)
      // Alpha is at indices 3, 7
      expect(img.data[3]).toBe(123)
      expect(img.data[7]).toBe(200)
    }
  })

  it('throws on an unknown mode', () => {
    const img = makeImageData([0, 0, 0, 255])
    expect(() => applyMode(img, 'nope' as never)).toThrow()
  })
})

describe('renderOutputMode — watermark overlay', () => {
  type StubCtx = { __drawCalls?: { method: string }[] }

  function getRegistry(): StubCtx[] {
    const g = globalThis as { __stubCtxRegistry?: StubCtx[] }
    if (!g.__stubCtxRegistry) throw new Error('stubCtxRegistry missing — vitest setup not loaded')
    return g.__stubCtxRegistry
  }

  function countTextDraws(registry: readonly StubCtx[]): number {
    let total = 0
    for (const ctx of registry) {
      for (const call of ctx.__drawCalls ?? []) {
        if (call.method === 'fillText' || call.method === 'strokeText') total += 1
      }
    }
    return total
  }

  /**
   * Forge a "bitmap-like" Blob — `vitest.setup.ts` stubs
   * `createImageBitmap` as identity, so passing width/height on the
   * Blob is enough to drive `renderOutputMode`'s canvas sizing without
   * needing real PNG bytes.
   */
  function makeBitmapBlob(width: number, height: number): Blob {
    const blob = new Blob([new Uint8Array(4)], { type: 'image/png' })
    Object.assign(blob, { width, height })
    return blob
  }

  it('omits the watermark pass when called without a config', async () => {
    const registry = getRegistry()
    registry.length = 0
    const out = await renderOutputMode(makeBitmapBlob(256, 256), 'scan')
    expect(out.blob.type).toBe('image/png')
    expect(out.mode).toBe('scan')
    // No `fillText`/`strokeText` calls — watermark kernel was skipped.
    expect(countTextDraws(registry)).toBe(0)
  })

  it('overlays watermark glyphs when called with an enabled config', async () => {
    const registry = getRegistry()
    registry.length = 0
    const watermark: WatermarkConfig = {
      enabled: true,
      text: 'TEST WATERMARK',
      opacity: 0.4,
      density: 'sparse',
    }
    const out = await renderOutputMode(makeBitmapBlob(256, 256), 'scan', watermark)
    expect(out.blob.type).toBe('image/png')
    // Diagonal tiling makes the exact count environment-dependent —
    // just assert the kernel produced a non-trivial set of glyphs so
    // the watermarked variant is visibly different from the bare pass.
    expect(countTextDraws(registry)).toBeGreaterThan(0)
  })

  it('passing a disabled config behaves identically to passing undefined', async () => {
    // First, capture the bare-pass baseline.
    const registry = getRegistry()
    registry.length = 0
    const bare = await renderOutputMode(makeBitmapBlob(256, 256), 'scan')
    const baseTextDraws = countTextDraws(registry)

    // Then run with an explicit `enabled: false` config — drawWatermark
    // is contractually a noop in that case.
    registry.length = 0
    const disabled: WatermarkConfig = {
      enabled: false,
      text: 'IGNORED',
      opacity: 0.7,
      density: 'dense',
    }
    const off = await renderOutputMode(makeBitmapBlob(256, 256), 'scan', disabled)
    expect(off.blob.type).toBe(bare.blob.type)
    expect(off.mode).toBe(bare.mode)
    expect(countTextDraws(registry)).toBe(baseTextDraws)
    expect(countTextDraws(registry)).toBe(0)
  })
})

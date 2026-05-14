import { describe, expect, it } from 'vitest'

import { applyMode } from './render-modes'

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

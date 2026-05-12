import { describe, expect, it } from 'vitest'
import {
  bilinearResize,
  composeMaskIntoOriginal,
  maskFloatToUint8,
  postprocessMask,
} from '@/features/segmentation/postprocess'

describe('maskFloatToUint8', () => {
  it('rounds [0, 1] floats into [0, 255] uint8', () => {
    const out = maskFloatToUint8(new Float32Array([0, 0.5, 1]))
    expect(Array.from(out)).toEqual([0, 128, 255])
  })

  it('clamps negative and >1 values', () => {
    const out = maskFloatToUint8(new Float32Array([-0.3, 1.7]))
    expect(Array.from(out)).toEqual([0, 255])
  })
})

describe('bilinearResize', () => {
  it('returns identity when src and dst dims match', () => {
    const src = new Uint8Array([10, 20, 30, 40])
    const out = bilinearResize(src, 2, 2, 2, 2)
    expect(Array.from(out)).toEqual([10, 20, 30, 40])
  })

  it('downsamples a 4x4 ramp to 2x2', () => {
    const src = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255])
    const out = bilinearResize(src, 4, 4, 2, 2)
    expect(out.length).toBe(4)
    // Top row sees row indices 0 and 2 (boundary) — close to 0/255
    expect(out[0]).toBeLessThan(128)
    expect(out[2]).toBeGreaterThan(128)
  })

  it('upsamples a 2x2 to 4x4 with smooth interpolation', () => {
    const src = new Uint8Array([0, 255, 0, 255])
    const out = bilinearResize(src, 2, 2, 4, 4)
    expect(out.length).toBe(16)
    // First column should track src col 0 = 0, last column should track 255.
    expect(out[0]).toBe(0)
    expect(out[3]).toBe(255)
  })

  it('throws on bad dims', () => {
    expect(() => bilinearResize(new Uint8Array(0), 0, 1, 1, 1)).toThrow(RangeError)
  })
})

describe('composeMaskIntoOriginal', () => {
  it('produces an RGBA buffer at the original dimensions', () => {
    const mask = new Uint8Array(4 * 4).fill(255)
    const out = composeMaskIntoOriginal(mask, 4, 4, 8, 8, { sx: 2, sy: 2, sw: 4, sh: 4 })
    expect(out.width).toBe(8)
    expect(out.height).toBe(8)
    expect(out.data.length).toBe(8 * 8 * 4)
  })

  it('leaves pixels outside the crop window fully transparent', () => {
    const mask = new Uint8Array(2 * 2).fill(255)
    const out = composeMaskIntoOriginal(mask, 2, 2, 4, 4, { sx: 1, sy: 1, sw: 2, sh: 2 })
    // (0, 0) is outside the crop → alpha must be 0.
    const cornerAlpha = out.data[(0 * 4 + 0) * 4 + 3]
    expect(cornerAlpha).toBe(0)
  })

  it('places the mask inside the crop window with foreground white', () => {
    const mask = new Uint8Array(2 * 2).fill(200)
    const out = composeMaskIntoOriginal(mask, 2, 2, 4, 4, { sx: 1, sy: 1, sw: 2, sh: 2 })
    // pixel (2, 2) is inside the crop (dst y=1 row, x=1 col).
    const idx = (2 * 4 + 2) * 4
    expect(out.data[idx + 0]).toBe(255) // R
    expect(out.data[idx + 1]).toBe(255) // G
    expect(out.data[idx + 2]).toBe(255) // B
    expect(out.data[idx + 3]).toBe(200) // A from mask
  })
})

describe('postprocessMask end-to-end', () => {
  it('runs a 4x4 float mask through to a 16x16 RGBA buffer', () => {
    const modelOut = new Float32Array(4 * 4).fill(0.5)
    const out = postprocessMask(modelOut, 16, 16, { sx: 4, sy: 4, sw: 8, sh: 8 }, 4)
    expect(out.width).toBe(16)
    expect(out.height).toBe(16)
    // Center pixel should be inside the crop and have alpha ≈ 128.
    const idx = (8 * 16 + 8) * 4
    expect(out.data[idx + 3]).toBeGreaterThan(120)
    expect(out.data[idx + 3]).toBeLessThan(135)
  })

  it('rejects mismatched model output sizes', () => {
    expect(() =>
      postprocessMask(new Float32Array(10), 16, 16, { sx: 0, sy: 0, sw: 16, sh: 16 }, 4),
    ).toThrow(RangeError)
  })
})

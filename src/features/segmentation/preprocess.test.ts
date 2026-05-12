import { describe, expect, it } from 'vitest'
import { computeCoverCrop, imageDataToTensor, MODEL_SIZE } from '@/features/segmentation/preprocess'

describe('computeCoverCrop', () => {
  it('returns the full source rect when aspect ratios match', () => {
    const c = computeCoverCrop(512, 512, 256, 256)
    expect(c).toEqual({ sx: 0, sy: 0, sw: 512, sh: 512 })
  })

  it('crops the sides for a landscape source going into a square dst', () => {
    const c = computeCoverCrop(1024, 512, 512, 512)
    expect(c.sy).toBe(0)
    expect(c.sh).toBe(512)
    expect(c.sw).toBe(512)
    expect(c.sx).toBe(256) // (1024 - 512) / 2
  })

  it('crops the top/bottom for a portrait source going into a square dst', () => {
    const c = computeCoverCrop(600, 1200, 512, 512)
    expect(c.sx).toBe(0)
    expect(c.sw).toBe(600)
    expect(c.sh).toBe(600)
    expect(c.sy).toBe(300) // (1200 - 600) / 2
  })

  it('matches the destination aspect ratio exactly', () => {
    const c = computeCoverCrop(1024, 768, 200, 100)
    expect(c.sw / c.sh).toBeCloseTo(2.0, 6)
  })

  it('throws on non-positive dimensions', () => {
    expect(() => computeCoverCrop(0, 100, 10, 10)).toThrow(RangeError)
    expect(() => computeCoverCrop(100, 100, -5, 10)).toThrow(RangeError)
  })
})

describe('imageDataToTensor', () => {
  function rgba(r: number, g: number, b: number, a = 255) {
    return [r, g, b, a]
  }

  it('produces the correct NCHW shape: 3 * width * height', () => {
    const data = new Uint8Array(2 * 2 * 4)
    const t = imageDataToTensor({ data, width: 2, height: 2 })
    expect(t.length).toBe(3 * 2 * 2)
  })

  it('normalizes [0, 255] -> [-1, 1]', () => {
    // 1x1 pixel: pure red. Expect R=+1, G=-1, B=-1.
    const data = new Uint8Array([...rgba(255, 0, 0)])
    const t = imageDataToTensor({ data, width: 1, height: 1 })
    expect(t[0]).toBeCloseTo(1, 6)
    expect(t[1]).toBeCloseTo(-1, 6)
    expect(t[2]).toBeCloseTo(-1, 6)
  })

  it('mid-grey (127.5) maps near zero', () => {
    const data = new Uint8Array([...rgba(128, 128, 128)])
    const t = imageDataToTensor({ data, width: 1, height: 1 })
    expect(Math.abs(t[0]!)).toBeLessThan(0.01)
    expect(Math.abs(t[1]!)).toBeLessThan(0.01)
    expect(Math.abs(t[2]!)).toBeLessThan(0.01)
  })

  it('uses planar (NCHW) layout — R plane first, then G, then B', () => {
    // 2x1 image: pixel 0 = red, pixel 1 = blue. With CHW layout we expect:
    //   plane R: [1, -1]
    //   plane G: [-1, -1]
    //   plane B: [-1, 1]
    const data = new Uint8Array([...rgba(255, 0, 0), ...rgba(0, 0, 255)])
    const t = imageDataToTensor({ data, width: 2, height: 1 })
    expect(t[0]).toBeCloseTo(1, 6) // R[0]
    expect(t[1]).toBeCloseTo(-1, 6) // R[1]
    expect(t[2]).toBeCloseTo(-1, 6) // G[0]
    expect(t[3]).toBeCloseTo(-1, 6) // G[1]
    expect(t[4]).toBeCloseTo(-1, 6) // B[0]
    expect(t[5]).toBeCloseTo(1, 6) // B[1]
  })

  it('drops the alpha channel', () => {
    // Same RGB, two different alphas -> identical tensor.
    const opaque = new Uint8Array([...rgba(100, 150, 200, 255)])
    const semi = new Uint8Array([...rgba(100, 150, 200, 64)])
    const t1 = imageDataToTensor({ data: opaque, width: 1, height: 1 })
    const t2 = imageDataToTensor({ data: semi, width: 1, height: 1 })
    expect(Array.from(t1)).toEqual(Array.from(t2))
  })

  it('throws if the data buffer is too short for the declared dimensions', () => {
    expect(() => imageDataToTensor({ data: new Uint8Array(3), width: 1, height: 1 })).toThrow(
      RangeError,
    )
  })

  it('matches MODEL_SIZE when fed a 512² buffer', () => {
    const data = new Uint8Array(MODEL_SIZE * MODEL_SIZE * 4)
    const t = imageDataToTensor({ data, width: MODEL_SIZE, height: MODEL_SIZE })
    expect(t.length).toBe(3 * MODEL_SIZE * MODEL_SIZE)
  })
})

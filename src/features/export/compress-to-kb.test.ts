/**
 * compressToKB — algorithm-level coverage with an injectable encoder.
 *
 * We model JPEG behaviour with a smooth function of `quality` and
 * `scale`, so the binary search has a well-defined landing point.
 * Tests assert:
 *
 *   - Easy targets converge inside the ±5 % band on the first round.
 *   - Hard targets (very small KB) trigger downscaling.
 *   - Impossible targets (smaller than the encoder floor) report
 *     `hit: false` with the closest miss.
 *   - Tolerance + probe counts are honoured.
 */

import { describe, expect, it } from 'vitest'

import { compressToKB, type EncodeFn } from './compress-to-kb'

/**
 * Synthetic JPEG-ish encoder.
 *
 *  size_kb = pixels × (0.04 × quality + 0.01) × 5e-3 + 1
 *
 * Roughly mimics real-world numbers: a 295×413 image lands at ~30 KB
 * at quality 0.95 and ~14 KB at quality 0.3, so the binary search has
 * a clean landing point around 25 KB.
 */
function makeFakeEncoder(): EncodeFn {
  return async ({ width, height, quality, mimeType }) => {
    const pixels = width * height
    const kb = pixels * (0.04 * quality + 0.01) * 5e-3 + 1
    const bytes = Math.round(kb * 1024)
    const arr = new Uint8Array(bytes)
    return new Blob([arr], { type: mimeType })
  }
}

const SOURCE = { width: 295, height: 413 } as unknown as ImageBitmap

describe('compressToKB', () => {
  it('hits a comfortable target on the first round', async () => {
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      encode: makeFakeEncoder(),
    })
    expect(r.hit).toBe(true)
    expect(r.finalKB).toBeGreaterThanOrEqual(25 * 0.95)
    expect(r.finalKB).toBeLessThanOrEqual(25 * 1.05)
    expect(r.scale).toBe(1)
  })

  it('respects the civil-service exam target (21–30 KB) for a 295×413 source', async () => {
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      encode: makeFakeEncoder(),
    })
    expect(r.finalKB).toBeGreaterThanOrEqual(21)
    expect(r.finalKB).toBeLessThanOrEqual(30)
  })

  it('downscales when target is too small for the source', async () => {
    // 295×413 at min quality emits ~14 KB; reaching 3 KB requires
    // shrinking. With a steeper scale step the search can hit it.
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 3,
      scaleStep: 0.7,
      minScale: 0.2,
      encode: makeFakeEncoder(),
    })
    expect(r.scale).toBeLessThan(1)
    expect(r.hit).toBe(true)
  })

  it('returns hit=false with closest miss when target is below the encoder floor', async () => {
    // Encoder always produces ≥ 1 KB; target 0.1 KB is unreachable.
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 0.1,
      encode: makeFakeEncoder(),
      minScale: 0.5,
    })
    expect(r.hit).toBe(false)
    expect(r.finalKB).toBeGreaterThan(0)
  })

  it('reports number of probe attempts so callers can surface diagnostics', async () => {
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      encode: makeFakeEncoder(),
      qualityProbes: 4,
    })
    expect(r.attempts).toBeGreaterThan(0)
    expect(r.attempts).toBeLessThanOrEqual(4)
  })

  it('throws on invalid target', async () => {
    await expect(
      compressToKB({ source: SOURCE, targetKB: 0, encode: makeFakeEncoder() }),
    ).rejects.toThrow(/invalid targetKB/)
    await expect(
      compressToKB({ source: SOURCE, targetKB: -5, encode: makeFakeEncoder() }),
    ).rejects.toThrow(/invalid targetKB/)
  })

  it('throws when source has no dimensions and none were provided', async () => {
    await expect(
      compressToKB({
        source: {} as ImageBitmap,
        targetKB: 25,
        encode: makeFakeEncoder(),
      }),
    ).rejects.toThrow(/dimensions/)
  })

  it('uses initialWidth / initialHeight overrides over source.width/height', async () => {
    const encoder = makeFakeEncoder()
    // Source is 295×413, but we tell the algorithm it's 600×600.
    const r = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      initialWidth: 600,
      initialHeight: 600,
      encode: encoder,
    })
    expect(r.width).toBeLessThanOrEqual(600)
    expect(r.hit).toBe(true)
  })

  it('honours custom tolerance — tighter bands take more probes', async () => {
    const tight = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      tolerance: 0.01,
      encode: makeFakeEncoder(),
    })
    const loose = await compressToKB({
      source: SOURCE,
      targetKB: 25,
      tolerance: 0.5,
      encode: makeFakeEncoder(),
    })
    expect(tight.attempts).toBeGreaterThanOrEqual(loose.attempts)
  })
})

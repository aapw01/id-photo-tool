/**
 * Resample sanity checks. happy-dom's canvas doesn't actually run a
 * bilinear filter (it stubs `drawImage` as a noop) so these tests only
 * verify the contract callers depend on:
 *
 *   1. Output dimensions match the requested target.
 *   2. Zero / negative inputs clamp to a 1×1 canvas.
 *   3. Aggressive downscales (≥ 2×) don't throw — the two-step ladder
 *      should kick in and still produce a target-sized canvas.
 */

import { describe, expect, it } from 'vitest'

import { resample } from './resample'

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('resample', () => {
  it('produces a canvas at the requested target size', async () => {
    const src = makeCanvas(100, 100)
    const out = await resample({ source: src, targetWidth: 25, targetHeight: 25 })
    expect(out.width).toBe(25)
    expect(out.height).toBe(25)
  })

  it('clamps target dimensions to a minimum of 1×1', async () => {
    const src = makeCanvas(50, 50)
    const out = await resample({ source: src, targetWidth: 0, targetHeight: -10 })
    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
  })

  it('handles a 4000×4000 → 800×800 downscale without throwing', async () => {
    // Real-world worst case after the foreground cap: a 4000² source
    // being shrunk to a spec-sized cell. The two-step ladder should
    // run through an intermediate canvas and finish without error.
    const src = makeCanvas(4000, 4000)
    const out = await resample({ source: src, targetWidth: 800, targetHeight: 800 })
    expect(out.width).toBe(800)
    expect(out.height).toBe(800)
  })

  it('returns a canvas with the same target dims when no downscale is needed', async () => {
    const src = makeCanvas(120, 80)
    const out = await resample({ source: src, targetWidth: 120, targetHeight: 80 })
    expect(out.width).toBe(120)
    expect(out.height).toBe(80)
  })
})

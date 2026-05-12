/**
 * Resample sanity checks. Pica itself needs a real DOM canvas to
 * deliver Lanczos pixels, which happy-dom doesn't ship, so we mock
 * the `pica` module to record what the wrapper sends in. The asserts
 * focus on:
 *
 *   1. Pica is asked for the right quality level (Lanczos = 3).
 *   2. The wrapper falls back to native resampling when Pica throws.
 *   3. Target dimensions are honoured and clamped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetPicaForTesting, resample } from './resample'

interface PicaCall {
  fromWidth: number
  fromHeight: number
  toWidth: number
  toHeight: number
  quality: number | undefined
}

const calls: PicaCall[] = []
let nextResizeBehavior: 'ok' | 'throw' = 'ok'

vi.mock('pica', () => {
  return {
    default: () => ({
      resize: async (
        from: HTMLCanvasElement,
        to: HTMLCanvasElement,
        opts: { quality?: number },
      ) => {
        calls.push({
          fromWidth: from.width,
          fromHeight: from.height,
          toWidth: to.width,
          toHeight: to.height,
          quality: opts?.quality,
        })
        if (nextResizeBehavior === 'throw') throw new Error('synthetic pica failure')
        return to
      },
    }),
  }
})

beforeEach(() => {
  __resetPicaForTesting()
  calls.length = 0
  nextResizeBehavior = 'ok'
})

afterEach(() => {
  vi.restoreAllMocks()
})

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
    expect(calls).toHaveLength(1)
    expect(calls[0]!.toWidth).toBe(25)
    expect(calls[0]!.toHeight).toBe(25)
  })

  it('clamps target dimensions to a minimum of 1×1', async () => {
    const src = makeCanvas(50, 50)
    const out = await resample({ source: src, targetWidth: 0, targetHeight: -10 })
    expect(out.width).toBe(1)
    expect(out.height).toBe(1)
  })

  it('passes Lanczos quality=3 by default and respects overrides', async () => {
    const src = makeCanvas(64, 64)
    await resample({ source: src, targetWidth: 16, targetHeight: 16 })
    expect(calls[0]!.quality).toBe(3)
    await resample({ source: src, targetWidth: 16, targetHeight: 16, quality: 0 })
    expect(calls[1]!.quality).toBe(0)
  })

  it('falls back to native canvas drawImage when Pica throws', async () => {
    nextResizeBehavior = 'throw'
    const src = makeCanvas(40, 40)
    const out = await resample({ source: src, targetWidth: 10, targetHeight: 10 })
    expect(out.width).toBe(10)
    expect(out.height).toBe(10)
  })
})

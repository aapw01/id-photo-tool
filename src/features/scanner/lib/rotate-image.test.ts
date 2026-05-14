import { describe, expect, it, vi, beforeEach } from 'vitest'

import { rotateImage } from './rotate-image'

/**
 * The vitest setup stubs `document.createElement('canvas')` with a
 * happy-dom canvas; `toBlob` is shimmed to a small PNG-mime blob and
 * `createImageBitmap` echoes the input shape. We assert behaviour at
 * the dimension-swap level — the canvas pixels themselves aren't
 * inspectable in this environment.
 */

function makeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('rotateImage', () => {
  beforeEach(() => {
    // Ensure each test starts with a clean canvas stub.
    vi.clearAllMocks()
  })

  it('swaps width / height for a 90° rotation', async () => {
    const src = makeBitmap(800, 600)
    const out = await rotateImage(src, 90)
    expect(out.bitmap.width).toBe(600)
    expect(out.bitmap.height).toBe(800)
  })

  it('keeps width / height for a 180° rotation', async () => {
    const src = makeBitmap(800, 600)
    const out = await rotateImage(src, 180)
    expect(out.bitmap.width).toBe(800)
    expect(out.bitmap.height).toBe(600)
  })

  it('swaps width / height for a 270° rotation', async () => {
    const src = makeBitmap(800, 600)
    const out = await rotateImage(src, 270)
    expect(out.bitmap.width).toBe(600)
    expect(out.bitmap.height).toBe(800)
  })

  it('produces a PNG blob alongside the rotated bitmap', async () => {
    const src = makeBitmap(800, 600)
    const out = await rotateImage(src, 90)
    expect(out.blob.type).toBe('image/png')
  })
})

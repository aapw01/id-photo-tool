import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyAlphaMatteToImageData,
  compositeIntoImageData,
  extractForeground,
  extractForegroundCapped,
  parseHex,
  scaleFrameForForeground,
  toHex,
  type BgColor,
} from '@/features/background/composite'

// happy-dom does not ship `OffscreenCanvas`, but `extractForeground`
// gates one of its return branches with a bare `canvas instanceof
// OffscreenCanvas`. `typeof` is safe with undeclared identifiers,
// `instanceof` is not — without the identifier the call throws a
// ReferenceError before we ever return. Install a small class that
// wraps an HTMLCanvasElement so the branch executes and the inner
// stubbed context still runs the matte / spill loops to completion.
if (typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas === 'undefined') {
  class OffscreenCanvasStub {
    width: number
    height: number
    private inner: HTMLCanvasElement
    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      this.inner = document.createElement('canvas')
      this.inner.width = w
      this.inner.height = h
    }
    getContext(kind: string): unknown {
      return this.inner.getContext(kind as '2d') as unknown
    }
    transferToImageBitmap(): ImageBitmap {
      return this.inner as unknown as ImageBitmap
    }
  }
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: OffscreenCanvasStub,
    configurable: true,
  })
}

function rgba(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values)
}

describe('parseHex', () => {
  it('parses #RRGGBB', () => {
    expect(parseHex('#10B981')).toEqual({ r: 0x10, g: 0xb9, b: 0x81 })
  })

  it('parses RRGGBB without #', () => {
    expect(parseHex('438EDB')).toEqual({ r: 0x43, g: 0x8e, b: 0xdb })
  })

  it('parses #RGB shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#0af')).toEqual({ r: 0, g: 170, b: 255 })
  })

  it('returns null for invalid input', () => {
    expect(parseHex('')).toBeNull()
    expect(parseHex('xyz')).toBeNull()
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('#1234567')).toBeNull()
  })

  it('toHex round-trips', () => {
    expect(toHex({ r: 16, g: 185, b: 129 })).toBe('#10b981')
  })

  it('toHex clamps and rounds', () => {
    expect(toHex({ r: -10, g: 300, b: 127.4 })).toBe('#00ff7f')
  })
})

describe('compositeIntoImageData — transparent background', () => {
  const bg: BgColor = { kind: 'transparent' }

  it('multiplies original alpha by mask alpha', () => {
    // 1 pixel red, fully opaque; mask alpha = 128 → final alpha ≈ 128
    const orig = rgba([255, 0, 0, 255])
    const mask = rgba([0, 0, 0, 128])
    const out = compositeIntoImageData(orig, mask, bg)
    expect(out[0]).toBe(255)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(0)
    expect(out[3]).toBe(128)
  })

  it('keeps RGB unchanged regardless of mask', () => {
    const orig = rgba([10, 20, 30, 255, 40, 50, 60, 255])
    const mask = rgba([0, 0, 0, 0, 0, 0, 0, 255])
    const out = compositeIntoImageData(orig, mask, bg)
    expect(Array.from(out)).toEqual([10, 20, 30, 0, 40, 50, 60, 255])
  })

  it('preserves pre-existing transparency in the source', () => {
    const orig = rgba([200, 100, 50, 128])
    const mask = rgba([0, 0, 0, 255])
    const out = compositeIntoImageData(orig, mask, bg)
    expect(out[3]).toBe(128)
  })
})

describe('compositeIntoImageData — solid colour background', () => {
  it('fully-foreground pixel keeps original colour and becomes opaque', () => {
    const orig = rgba([255, 0, 0, 255])
    const mask = rgba([0, 0, 0, 255])
    const out = compositeIntoImageData(orig, mask, { kind: 'color', hex: '#FFFFFF' })
    expect(out[0]).toBe(255)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(0)
    expect(out[3]).toBe(255)
  })

  it('fully-background pixel takes on the bg colour and stays opaque', () => {
    const orig = rgba([255, 0, 0, 255])
    const mask = rgba([0, 0, 0, 0])
    const out = compositeIntoImageData(orig, mask, { kind: 'color', hex: '#438EDB' })
    expect(out[0]).toBe(0x43)
    expect(out[1]).toBe(0x8e)
    expect(out[2]).toBe(0xdb)
    expect(out[3]).toBe(255)
  })

  it('half-mask blends 50/50 between subject and background', () => {
    const orig = rgba([255, 0, 0, 255]) // pure red
    const mask = rgba([0, 0, 0, 128])
    const out = compositeIntoImageData(orig, mask, { kind: 'color', hex: '#0000FF' })
    // a ≈ 128/255 ≈ 0.502
    expect(out[0]).toBeGreaterThan(120)
    expect(out[0]).toBeLessThan(135) // R ≈ 128
    expect(out[1]).toBe(0)
    expect(out[2]).toBeGreaterThan(120)
    expect(out[2]).toBeLessThan(135) // B ≈ 128
    expect(out[3]).toBe(255)
  })

  it('rejects invalid hex strings', () => {
    expect(() =>
      compositeIntoImageData(rgba([0, 0, 0, 0]), rgba([0, 0, 0, 0]), {
        kind: 'color',
        hex: 'not-a-color',
      }),
    ).toThrow(/invalid hex/i)
  })
})

describe('compositeIntoImageData — buffer contracts', () => {
  it('throws on mismatched buffer lengths', () => {
    expect(() =>
      compositeIntoImageData(rgba([0, 0, 0, 0]), rgba([0, 0, 0]), { kind: 'transparent' }),
    ).toThrow(/mismatched/)
  })

  it('writes into the supplied out buffer when provided', () => {
    const out = new Uint8ClampedArray(4)
    const result = compositeIntoImageData(
      rgba([10, 20, 30, 255]),
      rgba([0, 0, 0, 255]),
      { kind: 'transparent' },
      out,
    )
    expect(result).toBe(out)
    expect(Array.from(out)).toEqual([10, 20, 30, 255])
  })

  it('rejects out buffer with wrong length', () => {
    expect(() =>
      compositeIntoImageData(
        rgba([0, 0, 0, 0]),
        rgba([0, 0, 0, 0]),
        { kind: 'transparent' },
        new Uint8ClampedArray(8),
      ),
    ).toThrow(/length mismatch/i)
  })
})

describe('applyAlphaMatteToImageData', () => {
  it('removes red background contamination before transparent pixels lose their original colour', () => {
    const width = 5
    const height = 3
    const redBg: [number, number, number] = [220, 30, 30]
    const darkHair: [number, number, number] = [34, 32, 30]
    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const alpha = x === 1 ? 96 : x === 2 ? 196 : x >= 3 ? 255 : 0
        const t = alpha / 255
        orig[idx + 0] = Math.round(darkHair[0] * t + redBg[0] * (1 - t))
        orig[idx + 1] = Math.round(darkHair[1] * t + redBg[1] * (1 - t))
        orig[idx + 2] = Math.round(darkHair[2] * t + redBg[2] * (1 - t))
        orig[idx + 3] = 255
        mask[idx + 3] = alpha
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height)
    const softEdge = (1 * width + 1) * 4

    expect(out[softEdge + 0]).toBeLessThan(80)
    expect(out[softEdge + 1]).toBeLessThan(70)
    expect(out[softEdge + 2]).toBeLessThan(70)
    expect(out[softEdge + 3]).toBe(96)
  })

  it('leaves fully transparent and fully opaque pixels stable while applying the mask', () => {
    const orig = rgba([200, 30, 40, 255, 20, 30, 40, 255])
    const mask = rgba([0, 0, 0, 0, 0, 0, 0, 255])

    const out = applyAlphaMatteToImageData(orig, mask, 2, 1, undefined, {
      bg: { r: 200, g: 30, b: 40 },
    })

    expect(Array.from(out)).toEqual([0, 0, 0, 0, 20, 30, 40, 255])
  })
})

describe('applyAlphaMatteToImageData — red-halo regression', () => {
  // Anti-regression suite for the "5–8px pink ring around hair after
  // swapping a red ID-photo background" bug. Each test pins down one
  // failure mode of the previous fix.

  it('falls back to image corners when the outer ring estimator finds no near-transparent samples', () => {
    // 9×9 image where the entire centre is opaque subject and the only
    // mask-alpha-0 pixels sit at the corners — the outer ring estimator
    // (forced to radius=1) sees nothing low enough and must defer to
    // the corner sampler.
    const width = 9
    const height = 9
    const redBg: [number, number, number] = [220, 30, 30]
    const darkHair: [number, number, number] = [40, 40, 40]
    const haloMix: [number, number, number] = [130, 35, 35]

    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)

    const isSubject = (x: number, y: number) => x >= 3 && x <= 5 && y >= 3 && y <= 5
    const isBoundaryRing = (x: number, y: number) =>
      !isSubject(x, y) && x >= 2 && x <= 6 && y >= 2 && y <= 6

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        orig[idx + 3] = 255
        if (isSubject(x, y)) {
          orig[idx + 0] = darkHair[0]
          orig[idx + 1] = darkHair[1]
          orig[idx + 2] = darkHair[2]
          mask[idx + 3] = 255
        } else if (isBoundaryRing(x, y)) {
          // 128 keeps the unmix loop honest while staying well above
          // the alphaLow=16 cutoff so the outer-ring estimator skips it.
          orig[idx + 0] = haloMix[0]
          orig[idx + 1] = haloMix[1]
          orig[idx + 2] = haloMix[2]
          mask[idx + 3] = 128
        } else {
          orig[idx + 0] = redBg[0]
          orig[idx + 1] = redBg[1]
          orig[idx + 2] = redBg[2]
          mask[idx + 3] = 0
        }
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height, undefined, {
      radius: 1,
    })
    const target = (3 * width + 2) * 4 // boundary ring pixel adjacent to subject (3, 3)

    expect(orig[target + 0]).toBe(haloMix[0])
    expect(orig[target + 0]! - out[target + 0]!).toBeGreaterThanOrEqual(25)
  })

  it('preserves skin tones near a transparent red background', () => {
    // 30×1 strip: the leftmost 10 cells are mask=0 red background and
    // the rest is opaque skin. With the saturation guard + luma cutoff,
    // skin must not be pulled toward neutral.
    const width = 30
    const height = 1
    const redBg: [number, number, number] = [220, 30, 30]
    const skin: [number, number, number] = [220, 175, 150]
    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)
    for (let x = 0; x < width; x++) {
      const idx = x * 4
      orig[idx + 3] = 255
      if (x < 10) {
        orig[idx + 0] = redBg[0]
        orig[idx + 1] = redBg[1]
        orig[idx + 2] = redBg[2]
        mask[idx + 3] = 0
      } else {
        orig[idx + 0] = skin[0]
        orig[idx + 1] = skin[1]
        orig[idx + 2] = skin[2]
        mask[idx + 3] = 255
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height)
    const target = 15 * 4 // skin pixel within 18px of transparent bg

    expect(orig[target + 0]! - out[target + 0]!).toBeLessThanOrEqual(6)
    expect(out[target + 1]).toBe(skin[1])
    expect(out[target + 2]).toBe(skin[2])
  })

  it('leaves near-neutral dark pixels untouched (saturation guard)', () => {
    // Same 30×1 setup but the foreground is deep neutral hair body
    // instead of skin — sat < 0.16 must short-circuit the suppression.
    const width = 30
    const height = 1
    const redBg: [number, number, number] = [220, 30, 30]
    const neutralDark: [number, number, number] = [34, 32, 30]
    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)
    for (let x = 0; x < width; x++) {
      const idx = x * 4
      orig[idx + 3] = 255
      if (x < 10) {
        orig[idx + 0] = redBg[0]
        orig[idx + 1] = redBg[1]
        orig[idx + 2] = redBg[2]
        mask[idx + 3] = 0
      } else {
        orig[idx + 0] = neutralDark[0]
        orig[idx + 1] = neutralDark[1]
        orig[idx + 2] = neutralDark[2]
        mask[idx + 3] = 255
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height)
    const target = 15 * 4

    expect(Math.abs(out[target + 0]! - neutralDark[0])).toBeLessThanOrEqual(2)
    expect(Math.abs(out[target + 1]! - neutralDark[1])).toBeLessThanOrEqual(2)
    expect(Math.abs(out[target + 2]! - neutralDark[2])).toBeLessThanOrEqual(2)
  })

  it('clears a high-alpha hair-edge red cast (this is the user-visible bug)', () => {
    // 5×5 image: 3×3 opaque hair-edge centre, single-pixel-wide ring of
    // transparent red around it. The centre is the ~72/28 dark-hair /
    // red-background mix the model leaves at the boundary.
    const width = 5
    const height = 5
    const redBg: [number, number, number] = [220, 30, 30]
    const hairEdge: [number, number, number] = [86, 31, 30]
    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        orig[idx + 3] = 255
        const onRing = x === 0 || x === width - 1 || y === 0 || y === height - 1
        if (onRing) {
          orig[idx + 0] = redBg[0]
          orig[idx + 1] = redBg[1]
          orig[idx + 2] = redBg[2]
          mask[idx + 3] = 0
        } else {
          orig[idx + 0] = hairEdge[0]
          orig[idx + 1] = hairEdge[1]
          orig[idx + 2] = hairEdge[2]
          mask[idx + 3] = 255
        }
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height)
    const target = (1 * width + 1) * 4 // top-left interior hair pixel

    expect(out[target + 0]).toBeLessThanOrEqual(55)
    expect(out[target + 1]).toBeGreaterThanOrEqual(40)
    expect(out[target + 2]).toBeGreaterThanOrEqual(40)
  })

  it('never overshoots past neutral on the same hair-edge scenario', () => {
    // Re-runs the (4) case and pins down that the amount-clamp keeps us
    // from inventing a complementary cyan/green tint at the boundary.
    const width = 5
    const height = 5
    const redBg: [number, number, number] = [220, 30, 30]
    const hairEdge: [number, number, number] = [86, 31, 30]
    const orig = new Uint8ClampedArray(width * height * 4)
    const mask = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        orig[idx + 3] = 255
        const onRing = x === 0 || x === width - 1 || y === 0 || y === height - 1
        if (onRing) {
          orig[idx + 0] = redBg[0]
          orig[idx + 1] = redBg[1]
          orig[idx + 2] = redBg[2]
          mask[idx + 3] = 0
        } else {
          orig[idx + 0] = hairEdge[0]
          orig[idx + 1] = hairEdge[1]
          orig[idx + 2] = hairEdge[2]
          mask[idx + 3] = 255
        }
      }
    }

    const out = applyAlphaMatteToImageData(orig, mask, width, height)
    const target = (1 * width + 1) * 4

    expect(out[target + 0]).toBeGreaterThanOrEqual(0)
    expect(out[target + 1]! - out[target + 0]!).toBeLessThanOrEqual(25)
    expect(out[target + 2]! - out[target + 0]!).toBeLessThanOrEqual(25)
  })
})

describe('scaleFrameForForeground', () => {
  it('returns the original frame when foreground size matches bitmap', () => {
    const frame = { x: 100, y: 200, w: 300, h: 400 }
    expect(scaleFrameForForeground(frame, 1000, 1500, 1000, 1500)).toEqual(frame)
  })

  it('scales proportionally when foreground is downscaled', () => {
    const frame = { x: 100, y: 200, w: 400, h: 600 }
    // bitmap 4000×6000 → foreground 1000×1500 = scale 0.25 each axis
    const scaled = scaleFrameForForeground(frame, 4000, 6000, 1000, 1500)
    expect(scaled.x).toBeCloseTo(25)
    expect(scaled.y).toBeCloseTo(50)
    expect(scaled.w).toBeCloseTo(100)
    expect(scaled.h).toBeCloseTo(150)
  })
})

describe('extractForegroundCapped', () => {
  it('caps a 4000×4000 working canvas to ≤ 1600 on the long side', async () => {
    // happy-dom doesn't ship a real ImageBitmap, but
    // `extractForegroundCapped` only reads width/height and hands the
    // object straight to `drawImage` (stubbed) and `createImageBitmap`
    // (identity-stubbed in vitest.setup.ts). A plain canvas of the
    // right shape is sufficient to exercise the cap path.
    const bitmap = document.createElement('canvas')
    bitmap.width = 4000
    bitmap.height = 4000

    const mask: ImageData = {
      data: new Uint8ClampedArray(4000 * 4000 * 4),
      width: 4000,
      height: 4000,
      colorSpace: 'srgb',
    }

    const fg = await extractForegroundCapped(bitmap as unknown as ImageBitmap, mask)
    const longest = Math.max((fg as { width: number }).width, (fg as { height: number }).height)
    expect(longest).toBeLessThanOrEqual(1600)
  })

  it('caps non-square sources to the long side while preserving aspect', async () => {
    const bitmap = document.createElement('canvas')
    bitmap.width = 5472
    bitmap.height = 3648
    const mask: ImageData = {
      data: new Uint8ClampedArray(5472 * 3648 * 4),
      width: 5472,
      height: 3648,
      colorSpace: 'srgb',
    }
    const fg = await extractForegroundCapped(bitmap as unknown as ImageBitmap, mask)
    const w = (fg as { width: number }).width
    const h = (fg as { height: number }).height
    expect(Math.max(w, h)).toBe(1600)
    // Aspect ratio preserved within sub-pixel rounding.
    expect(w / h).toBeCloseTo(5472 / 3648, 1)
  })

  it('passes the bitmap through untouched when it already fits the cap', async () => {
    const bitmap = document.createElement('canvas')
    bitmap.width = 800
    bitmap.height = 600
    const mask: ImageData = {
      data: new Uint8ClampedArray(800 * 600 * 4),
      width: 800,
      height: 600,
      colorSpace: 'srgb',
    }
    const fg = await extractForegroundCapped(bitmap as unknown as ImageBitmap, mask)
    expect((fg as { width: number }).width).toBe(800)
    expect((fg as { height: number }).height).toBe(600)
  })
})

describe('extractForeground fallback', () => {
  // The preferred pixel path reads `getImageData` and applies the
  // matte / spill suppression in-place. Tainted canvases (or restricted
  // OffscreenCanvas implementations) throw on that call — `composite`
  // must fall back to the GPU `destination-in` path so the user still
  // gets a cutout. Force the fallback by stubbing `getImageData` to
  // throw and assert the call completes without error.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the destination-in path when getImageData throws', async () => {
    const proto =
      typeof globalThis.OffscreenCanvas !== 'undefined'
        ? (globalThis.OffscreenCanvas.prototype.getContext as unknown as undefined)
        : undefined
    // Stub the 2D context's getImageData to throw for the first call
    // and let subsequent calls (the fallback mask canvas) succeed.
    const realGetContext = HTMLCanvasElement.prototype.getContext
    let firstCall = true
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      kind: string,
    ) {
      const ctx = realGetContext.call(this, kind as '2d') as CanvasRenderingContext2D | null
      if (!ctx) return ctx
      if (kind === '2d' && firstCall) {
        firstCall = false
        const original = ctx.getImageData.bind(ctx)
        ctx.getImageData = ((...args: Parameters<typeof original>) => {
          if (firstCall === false) throw new Error('tainted')
          return original(...args)
        }) as typeof ctx.getImageData
      }
      return ctx
    } as typeof HTMLCanvasElement.prototype.getContext)
    void proto

    const bitmap = document.createElement('canvas')
    bitmap.width = 4
    bitmap.height = 4
    const mask: ImageData = {
      data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
      width: 4,
      height: 4,
      colorSpace: 'srgb',
    }

    const fg = await extractForeground(bitmap as unknown as ImageBitmap, mask)
    expect(fg).toBeDefined()
    expect((fg as { width: number }).width).toBe(4)
    expect((fg as { height: number }).height).toBe(4)
  })
})

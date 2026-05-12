import { describe, expect, it } from 'vitest'
import {
  applyAlphaMatteToImageData,
  compositeIntoImageData,
  parseHex,
  toHex,
  type BgColor,
} from '@/features/background/composite'

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

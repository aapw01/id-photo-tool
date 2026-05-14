import { describe, expect, it } from 'vitest'

import type { Quad } from './detect-corners'
import { getPerspectiveTransform, invert3, warpPerspectiveBilinear } from './perspective'

/**
 * Helpers for terse quad construction in tests.
 */
function quad(
  tl: [number, number],
  tr: [number, number],
  br: [number, number],
  bl: [number, number],
): Quad {
  return {
    topLeft: { x: tl[0], y: tl[1] },
    topRight: { x: tr[0], y: tr[1] },
    bottomRight: { x: br[0], y: br[1] },
    bottomLeft: { x: bl[0], y: bl[1] },
  }
}

/**
 * Project a single (x, y) through a 3×3 homography, mirroring the
 * inner kernel of `warpPerspectiveBilinear`. Used only by tests to
 * verify the matrix solves the right system.
 */
function project(m: ReturnType<typeof getPerspectiveTransform>, x: number, y: number) {
  const [a, b, c, d, e, f, g, h, i] = m
  const w = g * x + h * y + i
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w }
}

describe('getPerspectiveTransform', () => {
  it('maps identity quad to identity matrix (up to scale of last entry)', () => {
    const unit = quad([0, 0], [1, 0], [1, 1], [0, 1])
    const m = getPerspectiveTransform(unit, unit)
    expect(m[0]).toBeCloseTo(1, 6)
    expect(m[1]).toBeCloseTo(0, 6)
    expect(m[2]).toBeCloseTo(0, 6)
    expect(m[3]).toBeCloseTo(0, 6)
    expect(m[4]).toBeCloseTo(1, 6)
    expect(m[5]).toBeCloseTo(0, 6)
    expect(m[6]).toBeCloseTo(0, 6)
    expect(m[7]).toBeCloseTo(0, 6)
    expect(m[8]).toBe(1)
  })

  it('satisfies the 4 point correspondences for a tilted src → rectangle dst', () => {
    // A representative trapezoid (closer at top, farther at bottom)
    // mapping to a clean 100×60 rectangle — same shape of input the
    // real Scanner pipeline sees from phone photos.
    const src = quad([10, 5], [90, 8], [95, 55], [12, 58])
    const dst = quad([0, 0], [100, 0], [100, 60], [0, 60])
    const m = getPerspectiveTransform(src, dst)

    for (const corner of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
      const s = src[corner]
      const d = dst[corner]
      const p = project(m, s.x, s.y)
      expect(p.x).toBeCloseTo(d.x, 4)
      expect(p.y).toBeCloseTo(d.y, 4)
    }
  })

  it('throws on a degenerate (zero-area / collinear) quad', () => {
    const collinear = quad([0, 0], [1, 0], [2, 0], [3, 0])
    const dst = quad([0, 0], [1, 0], [1, 1], [0, 1])
    expect(() => getPerspectiveTransform(collinear, dst)).toThrow(/degenerate/)
  })
})

describe('invert3', () => {
  it('inverts the identity to itself', () => {
    const ident = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const
    const inv = invert3(ident)
    for (let i = 0; i < 9; i++) {
      expect(inv[i]).toBeCloseTo(ident[i]!, 6)
    }
  })

  it('round-trips a non-trivial transform (m · m⁻¹ ≈ I)', () => {
    const src = quad([10, 5], [90, 8], [95, 55], [12, 58])
    const dst = quad([0, 0], [100, 0], [100, 60], [0, 60])
    const m = getPerspectiveTransform(src, dst)
    const inv = invert3(m)
    const product = mul3(m, inv)
    expect(product[0]).toBeCloseTo(1, 4)
    expect(product[4]).toBeCloseTo(1, 4)
    expect(product[8]).toBeCloseTo(1, 4)
    expect(product[1]).toBeCloseTo(0, 4)
    expect(product[2]).toBeCloseTo(0, 4)
    expect(product[3]).toBeCloseTo(0, 4)
    expect(product[5]).toBeCloseTo(0, 4)
    expect(product[6]).toBeCloseTo(0, 4)
    expect(product[7]).toBeCloseTo(0, 4)
  })
})

describe('warpPerspectiveBilinear', () => {
  it('identity warp preserves every pixel exactly', () => {
    const src = makeCheckerboard(8, 8)
    const ident = quad([0, 0], [8, 0], [8, 8], [0, 8])
    const m = getPerspectiveTransform(ident, ident)
    const out = warpPerspectiveBilinear(src, m, 8, 8)
    expect(out.width).toBe(8)
    expect(out.height).toBe(8)
    for (let i = 0; i < src.data.length; i++) {
      // Bilinear at integer coordinates yields the same pixel —
      // allow 1 LSB slack for FP rounding at the borders.
      expect(Math.abs(out.data[i]! - src.data[i]!)).toBeLessThanOrEqual(1)
    }
  })

  it('uniform color source warps to uniform color destination', () => {
    const src = makeSolid(16, 16, [123, 45, 67, 255])
    const tilted = quad([2, 1], [14, 2], [15, 13], [3, 14])
    const dst = quad([0, 0], [20, 0], [20, 12], [0, 12])
    const m = getPerspectiveTransform(tilted, dst)
    const out = warpPerspectiveBilinear(src, m, 20, 12)
    expect(out.width).toBe(20)
    expect(out.height).toBe(12)
    // Every output pixel should be (123, 45, 67, 255) — uniform in
    // = uniform out is a strong sanity check on both the inverse
    // map and the bilinear weights summing to 1.
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(123)
      expect(out.data[i + 1]).toBe(45)
      expect(out.data[i + 2]).toBe(67)
      expect(out.data[i + 3]).toBe(255)
    }
  })

  it('BORDER_REPLICATE clamps samples that fall outside the source', () => {
    // Source 4×4 with a distinct first-column color so we can tell
    // whether out-of-bounds samples were clamped (correct) or read
    // as transparent / zero (wrong).
    const src = makeSolid(4, 4, [200, 200, 200, 255])
    for (let y = 0; y < 4; y++) {
      const off = (y * 4 + 0) * 4
      src.data[off] = 0
      src.data[off + 1] = 0
      src.data[off + 2] = 0
      src.data[off + 3] = 255
    }
    // Forward map projects the LEFT EDGE of dst (x = 0) to x = -1 in
    // source space, which is out of bounds. Replicate should clamp
    // it to x = 0 (the black column), so the dst left edge is black.
    const srcQuad = quad([-1, 0], [3, 0], [3, 3], [-1, 3])
    const dstQuad = quad([0, 0], [10, 0], [10, 6], [0, 6])
    const m = getPerspectiveTransform(srcQuad, dstQuad)
    const out = warpPerspectiveBilinear(src, m, 10, 6)
    for (let y = 0; y < 6; y++) {
      const off = (y * 10 + 0) * 4
      expect(out.data[off]).toBe(0)
      expect(out.data[off + 1]).toBe(0)
      expect(out.data[off + 2]).toBe(0)
    }
  })
})

function makeSolid(w: number, h: number, rgba: [number, number, number, number]): ImageData {
  const arr = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = rgba[0]
    arr[i + 1] = rgba[1]
    arr[i + 2] = rgba[2]
    arr[i + 3] = rgba[3]
  }
  return new ImageData(arr, w, h)
}

function makeCheckerboard(w: number, h: number): ImageData {
  const arr = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const black = (x + y) & 1
      arr[i] = black ? 0 : 255
      arr[i + 1] = black ? 0 : 255
      arr[i + 2] = black ? 0 : 255
      arr[i + 3] = 255
    }
  }
  return new ImageData(arr, w, h)
}

function mul3(a: ReturnType<typeof getPerspectiveTransform>, b: ReturnType<typeof invert3>) {
  const out = new Array<number>(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3 + 0]! * b[0 * 3 + c]! +
        a[r * 3 + 1]! * b[1 * 3 + c]! +
        a[r * 3 + 2]! * b[2 * 3 + c]!
    }
  }
  return out
}

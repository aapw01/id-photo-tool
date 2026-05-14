import { describe, expect, it } from 'vitest'

import { defaultQuad, orderClockwise, rotateQuadCW90, type QuadPoint } from './detect-corners'

describe('orderClockwise', () => {
  it('orders 4 points in TL → TR → BR → BL', () => {
    // Deliberately scrambled order.
    const pts: QuadPoint[] = [
      { x: 90, y: 110 }, // BR
      { x: 10, y: 100 }, // BL
      { x: 12, y: 8 }, // TL
      { x: 88, y: 10 }, // TR
    ]
    const q = orderClockwise(pts)
    expect(q.topLeft).toEqual({ x: 12, y: 8 })
    expect(q.topRight).toEqual({ x: 88, y: 10 })
    expect(q.bottomRight).toEqual({ x: 90, y: 110 })
    expect(q.bottomLeft).toEqual({ x: 10, y: 100 })
  })

  it('handles tilted quads (rotated rectangle, asymmetric)', () => {
    // A rotated rectangle — TL is the *smallest sum*, not the
    // smallest x-coordinate, so the ordering is non-trivial.
    // Coordinates chosen so all four sums are distinct, avoiding the
    // diamond-symmetry ambiguity where two points share a sum.
    const pts: QuadPoint[] = [
      { x: 60, y: 10 }, // ~TR-ish (sum 70)
      { x: 110, y: 70 }, // ~BR (sum 180)
      { x: 50, y: 120 }, // ~BL (sum 170)
      { x: 0, y: 60 }, // ~TL (sum 60)
    ]
    const q = orderClockwise(pts)
    expect(q.topLeft).toEqual({ x: 0, y: 60 })
    expect(q.bottomRight).toEqual({ x: 110, y: 70 })
    expect(q.topRight).toEqual({ x: 60, y: 10 })
    expect(q.bottomLeft).toEqual({ x: 50, y: 120 })
  })

  it('throws on wrong point count', () => {
    expect(() => orderClockwise([{ x: 0, y: 0 }] as QuadPoint[])).toThrow(/4 points/)
  })
})

describe('defaultQuad', () => {
  it('insets ~6 % from the image edges and is already TL → TR → BR → BL', () => {
    const q = defaultQuad(1000, 600)
    expect(q.topLeft.x).toBeCloseTo(60, 4)
    expect(q.topLeft.y).toBeCloseTo(36, 4)
    expect(q.topRight.x).toBeCloseTo(940, 4)
    expect(q.topRight.y).toBeCloseTo(36, 4)
    expect(q.bottomRight.x).toBeCloseTo(940, 4)
    expect(q.bottomRight.y).toBeCloseTo(564, 4)
    expect(q.bottomLeft.x).toBeCloseTo(60, 4)
    expect(q.bottomLeft.y).toBeCloseTo(564, 4)
  })

  it('survives a clockwise reorder unchanged', () => {
    // defaultQuad already produces canonical ordering — round-tripping
    // through orderClockwise should be a no-op.
    const q = defaultQuad(800, 500)
    const reordered = orderClockwise([q.topLeft, q.topRight, q.bottomRight, q.bottomLeft])
    expect(reordered).toEqual(q)
  })

  it('builds a centered rectangle matching targetAspect for a wider-than-target image', () => {
    // 16:9 photo (1.778) is wider than ID-card aspect (1.586) — so
    // height bounds the rect, width follows.
    const q = defaultQuad(1600, 900, 1.586)
    const rectH = 900 * (1 - 2 * 0.06)
    const rectW = rectH * 1.586
    expect(q.topLeft.x).toBeCloseTo((1600 - rectW) / 2, 4)
    expect(q.topLeft.y).toBeCloseTo((900 - rectH) / 2, 4)
    expect(q.bottomRight.x - q.topLeft.x).toBeCloseTo(rectW, 4)
    expect(q.bottomRight.y - q.topLeft.y).toBeCloseTo(rectH, 4)
    expect((q.bottomRight.x - q.topLeft.x) / (q.bottomRight.y - q.topLeft.y)).toBeCloseTo(1.586, 4)
  })

  it('builds a centered rectangle matching targetAspect for a narrower-than-target image', () => {
    // 4:3 phone photo (1.333) is narrower than ID-card aspect
    // (1.586) — so width bounds the rect, height follows.
    const q = defaultQuad(1000, 750, 1.586)
    const rectW = 1000 * (1 - 2 * 0.06)
    const rectH = rectW / 1.586
    expect(q.topLeft.x).toBeCloseTo((1000 - rectW) / 2, 4)
    expect(q.topLeft.y).toBeCloseTo((750 - rectH) / 2, 4)
    expect((q.bottomRight.x - q.topLeft.x) / (q.bottomRight.y - q.topLeft.y)).toBeCloseTo(1.586, 4)
  })

  it('builds a centered rectangle matching targetAspect for a tall portrait phone photo', () => {
    // 9:16 portrait — much narrower than target, width-bound.
    const q = defaultQuad(1080, 1920, 1.586)
    const rectW = 1080 * (1 - 2 * 0.06)
    const rectH = rectW / 1.586
    expect(q.topLeft.x).toBeCloseTo((1080 - rectW) / 2, 4)
    expect(q.topLeft.y).toBeCloseTo((1920 - rectH) / 2, 4)
    expect((q.bottomRight.x - q.topLeft.x) / (q.bottomRight.y - q.topLeft.y)).toBeCloseTo(1.586, 4)
  })
})

describe('rotateQuadCW90', () => {
  it('rotates each corner so the labels match the new visual orientation', () => {
    // Source 1000 × 600, a centered 200 × 100 quad.
    const sourceHeight = 600
    const q = {
      topLeft: { x: 400, y: 250 },
      topRight: { x: 600, y: 250 },
      bottomRight: { x: 600, y: 350 },
      bottomLeft: { x: 400, y: 350 },
    }
    const rotated = rotateQuadCW90(q, sourceHeight)
    // After a 90° CW rotation in canvas space the old bottom-left
    // becomes the new top-left, etc. The arithmetic is rot(x, y) =
    // (sourceHeight - y, x).
    expect(rotated.topLeft).toEqual({ x: sourceHeight - 350, y: 400 })
    expect(rotated.topRight).toEqual({ x: sourceHeight - 250, y: 400 })
    expect(rotated.bottomRight).toEqual({ x: sourceHeight - 250, y: 600 })
    expect(rotated.bottomLeft).toEqual({ x: sourceHeight - 350, y: 600 })
  })

  it('round-trips to the original after 4 successive rotations', () => {
    // Source 800 × 500, asymmetric quad so any sign / axis mistake
    // would surface here.
    const q = {
      topLeft: { x: 120, y: 80 },
      topRight: { x: 700, y: 60 },
      bottomRight: { x: 680, y: 440 },
      bottomLeft: { x: 100, y: 460 },
    }
    let r = q
    let w = 800
    let h = 500
    for (let i = 0; i < 4; i++) {
      r = rotateQuadCW90(r, h)
      const tmp = w
      w = h
      h = tmp
    }
    expect(r.topLeft.x).toBeCloseTo(q.topLeft.x, 6)
    expect(r.topLeft.y).toBeCloseTo(q.topLeft.y, 6)
    expect(r.topRight.x).toBeCloseTo(q.topRight.x, 6)
    expect(r.topRight.y).toBeCloseTo(q.topRight.y, 6)
    expect(r.bottomRight.x).toBeCloseTo(q.bottomRight.x, 6)
    expect(r.bottomRight.y).toBeCloseTo(q.bottomRight.y, 6)
    expect(r.bottomLeft.x).toBeCloseTo(q.bottomLeft.x, 6)
    expect(r.bottomLeft.y).toBeCloseTo(q.bottomLeft.y, 6)
  })
})

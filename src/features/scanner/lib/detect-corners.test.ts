import { describe, expect, it } from 'vitest'

import { defaultQuad, orderClockwise, type QuadPoint } from './detect-corners'

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
})

import { describe, expect, it } from 'vitest'

import { orderClockwise, type QuadPoint } from './detect-corners'

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

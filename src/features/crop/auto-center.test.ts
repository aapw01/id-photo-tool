import { describe, expect, it } from 'vitest'
import { autoCenter, centerCrop, estimateHeadVerticalSpan } from '@/features/crop/auto-center'
import { getPhotoSpec } from '@/data/photo-specs'
import type { FaceDetection, PhotoSpec } from '@/types/spec'

function makeFace(opts: {
  eyeY: number
  mouthY: number
  eyeLX: number
  eyeRX?: number
  bboxX?: number
  bboxY?: number
  bboxW?: number
  bboxH?: number
}): FaceDetection {
  const eyeRX = opts.eyeRX ?? opts.eyeLX + 60
  return {
    bbox: {
      x: opts.bboxX ?? opts.eyeLX - 20,
      y: opts.bboxY ?? opts.eyeY - 40,
      w: opts.bboxW ?? 200,
      h: opts.bboxH ?? 240,
    },
    keypoints: [
      { x: opts.eyeLX, y: opts.eyeY },
      { x: eyeRX, y: opts.eyeY },
      { x: (opts.eyeLX + eyeRX) / 2, y: opts.eyeY + 30 }, // nose
      { x: (opts.eyeLX + eyeRX) / 2, y: opts.mouthY }, // mouth
      { x: opts.eyeLX - 30, y: opts.eyeY + 10 }, // left-ear
      { x: eyeRX + 30, y: opts.eyeY + 10 }, // right-ear
    ],
    confidence: 0.95,
  }
}

const cnInch = getPhotoSpec('cn-1inch')!
const usVisa = getPhotoSpec('us-visa')!
const schengen = getPhotoSpec('schengen')!

describe('centerCrop', () => {
  it('width-limited image picks max width', () => {
    const f = centerCrop({ width: 600, height: 1200 }, 1) // square aspect
    expect(f.w).toBe(600)
    expect(f.h).toBe(600)
    expect(f.x).toBe(0)
    expect(f.y).toBe(300)
  })

  it('height-limited image picks max height', () => {
    const f = centerCrop({ width: 1200, height: 600 }, 1)
    expect(f.h).toBe(600)
    expect(f.w).toBe(600)
    expect(f.y).toBe(0)
    expect(f.x).toBe(300)
  })

  it('respects non-square aspects', () => {
    const aspect = 35 / 49 // cn-2inch
    const f = centerCrop({ width: 700, height: 1000 }, aspect)
    expect(f.w / f.h).toBeCloseTo(aspect)
  })
})

describe('estimateHeadVerticalSpan', () => {
  it('uses keypoints when present', () => {
    const face = makeFace({ eyeY: 200, mouthY: 260, eyeLX: 290 })
    const span = estimateHeadVerticalSpan(face)
    expect(span.eyeY).toBe(200)
    expect(span.chinY).toBeGreaterThan(span.eyeY) // chin is below
    expect(span.foreheadY).toBeLessThan(span.eyeY) // forehead is above
  })

  it('falls back to bbox when keypoints are missing', () => {
    const face: FaceDetection = {
      bbox: { x: 100, y: 50, w: 200, h: 240 },
      keypoints: [],
      confidence: 0.8,
    }
    const span = estimateHeadVerticalSpan(face)
    expect(span.foreheadY).toBe(50)
    expect(span.chinY).toBe(290)
    expect(span.headCenterX).toBe(200)
  })
})

describe('autoCenter — no face', () => {
  it('falls back to centerCrop with the spec aspect', () => {
    const frame = autoCenter({ width: 1000, height: 1500 }, cnInch, null)
    const expectedAspect = cnInch.width_mm / cnInch.height_mm
    expect(frame.w / frame.h).toBeCloseTo(expectedAspect)
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.w).toBeLessThanOrEqual(1000)
    expect(frame.y + frame.h).toBeLessThanOrEqual(1500)
  })
})

describe('autoCenter — with face', () => {
  const image = { width: 1000, height: 1500 }

  it('produces a frame with the spec aspect', () => {
    const face = makeFace({ eyeY: 500, mouthY: 620, eyeLX: 470 })
    const frame = autoCenter(image, cnInch, face)
    const aspect = cnInch.width_mm / cnInch.height_mm
    expect(frame.w / frame.h).toBeCloseTo(aspect, 2)
  })

  it('puts the eye line within the spec eye-from-top band', () => {
    const face = makeFace({ eyeY: 500, mouthY: 620, eyeLX: 470 })
    const frame = autoCenter(image, cnInch, face)
    const eyeYInFrame = 500 - frame.y
    const ratio = eyeYInFrame / frame.h
    const [lo, hi] = cnInch.composition!.eyeLineFromTop!
    // Allow ±0.05 wiggle for the clamp + rounding.
    expect(ratio).toBeGreaterThan(lo - 0.05)
    expect(ratio).toBeLessThan(hi + 0.05)
  })

  it('keeps frame inside image bounds when face is near top-left', () => {
    const face = makeFace({ eyeY: 60, mouthY: 130, eyeLX: 50 })
    const frame = autoCenter(image, usVisa, face)
    expect(frame.x).toBe(0)
    expect(frame.y).toBe(0)
    expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
    expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
  })

  it('keeps frame inside bounds when face is near bottom-right', () => {
    const face = makeFace({ eyeY: 1400, mouthY: 1450, eyeLX: 920 })
    const frame = autoCenter(image, schengen, face)
    expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
    expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
  })

  it('shrinks frame if it would overflow even after clamping', () => {
    // Huge head detected in a small image → frame would naturally be
    // bigger than the image.
    const small = { width: 400, height: 600 }
    const face = makeFace({ eyeY: 250, mouthY: 320, eyeLX: 170, eyeRX: 230 })
    const frame = autoCenter(small, cnInch, face)
    expect(frame.w).toBeLessThanOrEqual(small.width)
    expect(frame.h).toBeLessThanOrEqual(small.height)
  })

  it('handles square spec aspect (us-visa) on a portrait image', () => {
    const face = makeFace({ eyeY: 500, mouthY: 600, eyeLX: 470 })
    const frame = autoCenter(image, usVisa, face)
    expect(frame.w / frame.h).toBeCloseTo(1, 2)
  })

  it('different specs on the same face produce different frames', () => {
    const face = makeFace({ eyeY: 500, mouthY: 600, eyeLX: 470 })
    const inch = autoCenter(image, cnInch, face)
    const visa = autoCenter(image, usVisa, face)
    // Aspect alone should make the widths differ
    expect(inch.w).not.toBeCloseTo(visa.w, 0)
  })
})

describe('autoCenter — degenerate specs', () => {
  it('uses defaults when composition is missing', () => {
    const noComp: PhotoSpec = {
      ...cnInch,
      id: 'test-no-comp',
      composition: undefined,
    }
    const face = makeFace({ eyeY: 500, mouthY: 600, eyeLX: 470 })
    const frame = autoCenter({ width: 1000, height: 1500 }, noComp, face)
    expect(frame.w / frame.h).toBeCloseTo(noComp.width_mm / noComp.height_mm, 2)
  })
})

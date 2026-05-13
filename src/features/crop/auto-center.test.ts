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
    // foreheadY now includes a bbox-derived hair allowance
    // (bbox.y − bbox.h × 0.18 = 50 − 43.2 = 6.8) so it sits *above* the
    // raw bbox top instead of flush with it.
    expect(span.foreheadY).toBeCloseTo(6.8, 5)
    expect(span.chinY).toBe(290)
    expect(span.headCenterX).toBe(200)
  })

  it('picks the higher of the keypoint and bbox forehead estimates', () => {
    // Synthetic portrait face with hair-tall bbox: the bbox-derived
    // forehead (1100 − 1900 × 0.18 = 758) sits well above the keypoint
    // estimate (eyeY − 1.5 × eyeToMouth = 1850 − 900 = 950). The min of
    // the two is what we keep — that's the hair-inclusive head-top.
    const face: FaceDetection = {
      bbox: { x: 1100, y: 1100, w: 1450, h: 1900 },
      keypoints: [
        { x: 1500, y: 1850 },
        { x: 2150, y: 1850 },
        { x: 1820, y: 2150 },
        { x: 1820, y: 2450 },
        { x: 1180, y: 1880 },
        { x: 2460, y: 1880 },
      ],
      confidence: 0.95,
    }
    const span = estimateHeadVerticalSpan(face)
    const foreheadFromBbox = 1100 - 1900 * 0.18
    const foreheadFromKeypoints = 1850 - 1.5 * 600
    expect(span.foreheadY).toBeCloseTo(Math.min(foreheadFromBbox, foreheadFromKeypoints), 5)
    expect(span.foreheadY).toBeCloseTo(758, 5)
    // chin stays from the keypoint estimate.
    expect(span.chinY).toBeCloseTo(1850 + 1.7 * 600, 5)
    expect(span.headCenterX).toBe(1825)
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
    // The frame shrinks (instead of hard-clamping to the edge) so the
    // head still lands at the spec's intended composition. Bounds are
    // the contract; edge-pinning is not.
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
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

describe('autoCenter — shrink instead of jamming', () => {
  /**
   * Regression for the user-reported bug: choosing a 1:1 spec on a
   * 3648×5472 portrait pushed the natural frame past the image top,
   * the hard clamp jammed the head against the top edge, and the user
   * couldn't drag the frame down because the frame already touched
   * the image edge. The fix shrinks the frame so the head lands at
   * the spec's eye-from-top ratio without overflowing.
   */
  it('shrinks a square spec when the head would overflow the top of a tall portrait', () => {
    const image = { width: 3648, height: 5472 }
    const eyeFromTopRatio = 0.625
    const headHeightRatio = 0.595
    // 1:1 spec with the exact composition values from the bug report.
    const squareSpec: PhotoSpec = {
      ...usVisa,
      id: 'test-square-shrink',
      width_mm: 51,
      height_mm: 51,
      composition: {
        headHeightRatio: [headHeightRatio, headHeightRatio],
        eyeLineFromTop: [eyeFromTopRatio, eyeFromTopRatio],
      },
    }
    // headCenterX ≈ 1824 (= 3648/2). Head spans ~2000 px vertically
    // (X=625 → forehead 1062, chin 3062). Natural frame height would be
    // 2000/0.595 ≈ 3361 — taller than the eye position allows once
    // eye-from-top=0.625, so we must shrink.
    const face = makeFace({
      eyeY: 2000,
      mouthY: 2625,
      eyeLX: 1794,
      eyeRX: 1854,
    })

    const frame = autoCenter(image, squareSpec, face)

    // Frame is smaller than the image's width — proves the shrink path fired.
    expect(frame.w).toBeLessThan(image.width)
    expect(frame.h).toBeLessThan(image.height)
    // Aspect preserved.
    expect(frame.w / frame.h).toBeCloseTo(1, 3)
    // Frame inside image bounds.
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
    expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
    // Eye lands at the spec's eye-from-top ratio (±5 %).
    const ratio = (2000 - frame.y) / frame.h
    expect(Math.abs(ratio - eyeFromTopRatio)).toBeLessThan(0.05)
  })

  it('shrinks a tall 35×45 spec on a landscape image when the head is near the left edge', () => {
    // headCenterX near the left edge of a 4000×3000 landscape image.
    // Schengen-style spec is portrait (aspect ≈ 0.778). The natural
    // frame width would put left < 0; shrinking pulls it back so the
    // head ends up centred horizontally instead.
    const image = { width: 4000, height: 3000 }
    const face = makeFace({
      eyeY: 1500,
      mouthY: 2125,
      eyeLX: 170,
      eyeRX: 230, // headCenterX = 200
    })

    const frame = autoCenter(image, schengen, face)

    expect(frame.w).toBeLessThan(image.width)
    // Aspect preserved.
    expect(frame.w / frame.h).toBeCloseTo(schengen.width_mm / schengen.height_mm, 3)
    // Head centred horizontally inside the new frame (within 1 px).
    const headCenterInFrame = frame.x + frame.w / 2
    expect(Math.abs(headCenterInFrame - 200)).toBeLessThan(1)
  })

  it('reserves top-padding above the hair for a 美国签证 spec on a tall portrait', () => {
    // Regression for the "head jammed against the top edge" bug: with
    // hair-aware foreheadY, the auto-frame leaves at least ~3 % of its
    // height as clearance between the visible head-top and the frame
    // top — even though the keypoint-derived forehead would have put
    // the head-top several hundred px lower.
    const image = { width: 3648, height: 5472 }
    const face: FaceDetection = {
      bbox: { x: 1100, y: 1100, w: 1450, h: 1900 },
      keypoints: [
        { x: 1500, y: 1850 }, // left-eye
        { x: 2150, y: 1850 }, // right-eye
        { x: 1820, y: 2150 }, // nose
        { x: 1820, y: 2450 }, // mouth
        { x: 1180, y: 1880 }, // left-ear
        { x: 2460, y: 1880 }, // right-ear
      ],
      confidence: 0.95,
    }

    const frame = autoCenter(image, usVisa, face)

    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
    expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
    // Square aspect (us-visa).
    expect(frame.w / frame.h).toBeCloseTo(1, 3)
    // Hair-top estimate (bbox-derived) lies inside the frame with at
    // least ~3 % top padding. 1100 − 1900 × 0.18 = 758.
    const hairTop = 1100 - 1900 * 0.18
    expect(frame.y + frame.h * 0.03).toBeLessThanOrEqual(hairTop)
  })

  it('fills the head to the spec upper bound when bias=1', () => {
    // The head-size slider lets the user pick any point inside the
    // spec's headHeightRatio band. With bias=1 the head should fill
    // the maximum legal share of the frame, i.e. landing exactly on
    // the upper bound.
    const image = { width: 3648, height: 5472 }
    const face: FaceDetection = {
      bbox: { x: 1300, y: 1500, w: 1100, h: 1450 },
      keypoints: [
        { x: 1560, y: 2000 },
        { x: 2080, y: 2000 },
        { x: 1820, y: 2200 },
        { x: 1820, y: 2500 },
        { x: 1250, y: 2020 },
        { x: 2380, y: 2020 },
      ],
      confidence: 0.97,
    }

    const frame = autoCenter(image, usVisa, face, { headSizeBias: 1 })
    const span = estimateHeadVerticalSpan(face)
    const headRatio = (span.chinY - span.foreheadY) / frame.h
    const upperBound = usVisa.composition!.headHeightRatio![1]

    expect(headRatio).toBeCloseTo(upperBound, 2)
    expect(headRatio).toBeLessThanOrEqual(upperBound + 0.005)
    expect(headRatio).toBeGreaterThanOrEqual(usVisa.composition!.headHeightRatio![0])
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
    expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
  })

  it('slider bias slides the head ratio through the spec band', () => {
    // Three biases (lower / mid / upper) should produce three
    // distinct frame heights, ordered: lower bias → smallest head
    // share → biggest frame; upper bias → biggest head share →
    // smallest frame.
    const image = { width: 3648, height: 5472 }
    const face: FaceDetection = {
      bbox: { x: 1300, y: 1500, w: 1100, h: 1450 },
      keypoints: [
        { x: 1560, y: 2000 },
        { x: 2080, y: 2000 },
        { x: 1820, y: 2200 },
        { x: 1820, y: 2500 },
        { x: 1250, y: 2020 },
        { x: 2380, y: 2020 },
      ],
      confidence: 0.97,
    }

    const small = autoCenter(image, usVisa, face, { headSizeBias: 0 })
    const mid = autoCenter(image, usVisa, face, { headSizeBias: 0.5 })
    const big = autoCenter(image, usVisa, face, { headSizeBias: 1 })

    // Smaller head ratio ⇒ bigger frame.
    expect(small.h).toBeGreaterThan(mid.h)
    expect(mid.h).toBeGreaterThan(big.h)

    const [lo, hi] = usVisa.composition!.headHeightRatio!
    const span = estimateHeadVerticalSpan(face)
    const headHeight = span.chinY - span.foreheadY
    expect(headHeight / small.h).toBeCloseTo(lo, 2)
    expect(headHeight / mid.h).toBeCloseTo((lo + hi) / 2, 2)
    expect(headHeight / big.h).toBeCloseTo(hi, 2)
  })

  it('honours the mask-derived head-top hint over the heuristic', () => {
    // Even when the keypoint + bbox heuristic puts the forehead at one
    // place, a hint from the alpha mask should take precedence — e.g.
    // a subject with a tall bun where the real head-top sits well above
    // both estimates.
    const image = { width: 3648, height: 5472 }
    const face: FaceDetection = {
      bbox: { x: 1300, y: 1500, w: 1100, h: 1450 },
      keypoints: [
        { x: 1560, y: 2000 },
        { x: 2080, y: 2000 },
        { x: 1820, y: 2200 },
        { x: 1820, y: 2500 },
        { x: 1250, y: 2020 },
        { x: 2380, y: 2020 },
      ],
      confidence: 0.97,
    }

    const span = estimateHeadVerticalSpan(face) // heuristic forehead ~1239
    const maskTop = 600 // much higher up than either estimate
    const frame = autoCenter(image, usVisa, face, { headTopY: maskTop, headSizeBias: 0.5 })

    // Resulting head height in the compliance-style calculation
    // should use `maskTop`, not the heuristic forehead.
    const measuredHeadHeight = (span.chinY - maskTop) / frame.h
    const [lo, hi] = usVisa.composition!.headHeightRatio!
    expect(measuredHeadHeight).toBeCloseTo((lo + hi) / 2, 1)
  })

  it('keeps the resulting frame inside the image bounds across edge-case face placements', () => {
    const image = { width: 3648, height: 5472 }
    const cases = [
      makeFace({ eyeY: 200, mouthY: 320, eyeLX: 180, eyeRX: 240 }), // top
      makeFace({ eyeY: 5300, mouthY: 5400, eyeLX: 3400, eyeRX: 3460 }), // bottom-right
      makeFace({ eyeY: 2800, mouthY: 2920, eyeLX: 30, eyeRX: 90 }), // left edge
      makeFace({ eyeY: 2800, mouthY: 2920, eyeLX: 3560, eyeRX: 3620 }), // right edge
    ]
    for (const face of cases) {
      const frame = autoCenter(image, usVisa, face)
      expect(frame.x).toBeGreaterThanOrEqual(0)
      expect(frame.y).toBeGreaterThanOrEqual(0)
      expect(frame.x + frame.w).toBeLessThanOrEqual(image.width + 0.01)
      expect(frame.y + frame.h).toBeLessThanOrEqual(image.height + 0.01)
      // Aspect stays at the spec's 1:1 for us-visa.
      expect(frame.w / frame.h).toBeCloseTo(1, 3)
    }
  })
})

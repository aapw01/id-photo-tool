import { describe, expect, it } from 'vitest'
import { autoCenter } from '@/features/crop/auto-center'
import { checkCompliance } from '@/features/crop/compliance'
import { getPhotoSpec } from '@/data/photo-specs'
import type { FaceDetection } from '@/types/spec'

const cnInch = getPhotoSpec('cn-1inch')!
const usVisa = getPhotoSpec('us-visa')!

function face(opts: {
  eyeY: number
  mouthY: number
  eyeLX: number
  eyeRX?: number
}): FaceDetection {
  const eyeRX = opts.eyeRX ?? opts.eyeLX + 60
  return {
    bbox: { x: opts.eyeLX - 20, y: opts.eyeY - 40, w: 200, h: 240 },
    keypoints: [
      { x: opts.eyeLX, y: opts.eyeY },
      { x: eyeRX, y: opts.eyeY },
      { x: (opts.eyeLX + eyeRX) / 2, y: opts.eyeY + 30 },
      { x: (opts.eyeLX + eyeRX) / 2, y: opts.mouthY },
      { x: opts.eyeLX - 30, y: opts.eyeY + 10 },
      { x: eyeRX + 30, y: opts.eyeY + 10 },
    ],
    confidence: 0.9,
  }
}

describe('checkCompliance', () => {
  it('no warning when face detection failed', () => {
    // The yellow `face-not-found` banner used to nag every time
    // detection failed (CDN unreachable, photo without a person). The
    // friendly "Auto-centred" Info banner replaces it; compliance now
    // returns an empty warning list when `face === null`.
    const res = checkCompliance({ x: 0, y: 0, w: 100, h: 100 }, null, cnInch)
    expect(res.warnings).toHaveLength(0)
    expect(res.headRatio).toBeNull()
    expect(res.eyeFromTop).toBeNull()
  })

  it('autoCenter output passes compliance for the same spec', () => {
    const f = face({ eyeY: 500, mouthY: 620, eyeLX: 470 })
    const frame = autoCenter({ width: 1000, height: 1500 }, cnInch, f)
    const res = checkCompliance(frame, f, cnInch)
    // No warnings should fire for the natural output of autoCenter.
    expect(res.warnings.filter((w) => w.severity === 'warn')).toHaveLength(0)
    expect(res.headRatio).toBeGreaterThan(0)
  })

  it('flags head-too-small when frame is way bigger than head', () => {
    const f = face({ eyeY: 500, mouthY: 540, eyeLX: 480 }) // tiny head
    // Build an oversized frame around the face
    const frame = { x: 0, y: 0, w: 1000, h: 1400 }
    const res = checkCompliance(frame, f, cnInch)
    expect(res.warnings.map((w) => w.code)).toContain('head-too-small')
  })

  it('flags head-too-large when frame is tight around the head', () => {
    const f = face({ eyeY: 300, mouthY: 460, eyeLX: 220 }) // mouth-to-eye 160
    // Frame just barely larger than head height
    const frame = { x: 100, y: 100, w: 200, h: 300 }
    const res = checkCompliance(frame, f, cnInch)
    expect(res.warnings.map((w) => w.code)).toContain('head-too-large')
  })

  it('flags eye-too-high when eyes are near the frame top', () => {
    const f = face({ eyeY: 60, mouthY: 110, eyeLX: 470 })
    const frame = { x: 200, y: 0, w: 600, h: 800 } // eye at y=60, ratio 0.075
    const res = checkCompliance(frame, f, cnInch)
    expect(res.warnings.map((w) => w.code)).toContain('eye-too-high')
  })

  it('flags eye-too-low when eyes are near the frame bottom', () => {
    const f = face({ eyeY: 700, mouthY: 740, eyeLX: 470 })
    const frame = { x: 200, y: 0, w: 600, h: 800 } // eye ratio 0.875
    const res = checkCompliance(frame, f, cnInch)
    expect(res.warnings.map((w) => w.code)).toContain('eye-too-low')
  })

  it('honours per-spec bands (us-visa: 0.5-0.69 head ratio)', () => {
    const f = face({ eyeY: 400, mouthY: 480, eyeLX: 470 }) // moderate head
    // Frame produces head ratio ≈ 0.6 — should be inside US-visa band
    const inside = autoCenter({ width: 1000, height: 1500 }, usVisa, f)
    const res = checkCompliance(inside, f, usVisa)
    expect(res.warnings.filter((w) => w.severity === 'error')).toHaveLength(0)
  })

  it('returns headRatio + eyeFromTop alongside warnings', () => {
    const f = face({ eyeY: 500, mouthY: 600, eyeLX: 470 })
    const frame = autoCenter({ width: 1000, height: 1500 }, cnInch, f)
    const res = checkCompliance(frame, f, cnInch)
    expect(res.headRatio).toBeGreaterThan(0.5)
    expect(res.eyeFromTop).toBeGreaterThan(0.25)
    expect(res.eyeFromTop).toBeLessThan(0.5)
  })
})

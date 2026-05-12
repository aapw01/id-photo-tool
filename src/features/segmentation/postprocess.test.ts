import { describe, expect, it } from 'vitest'
import {
  bilinearResize,
  composeMaskIntoOriginal,
  decontaminateEdges,
  estimateOuterRingBg,
  maskFloatToUint8,
  postprocessMask,
  refineAlpha,
} from '@/features/segmentation/postprocess'

describe('maskFloatToUint8', () => {
  it('rounds [0, 1] floats into [0, 255] uint8', () => {
    const out = maskFloatToUint8(new Float32Array([0, 0.5, 1]))
    expect(Array.from(out)).toEqual([0, 128, 255])
  })

  it('clamps negative and >1 values', () => {
    const out = maskFloatToUint8(new Float32Array([-0.3, 1.7]))
    expect(Array.from(out)).toEqual([0, 255])
  })
})

describe('bilinearResize', () => {
  it('returns identity when src and dst dims match', () => {
    const src = new Uint8Array([10, 20, 30, 40])
    const out = bilinearResize(src, 2, 2, 2, 2)
    expect(Array.from(out)).toEqual([10, 20, 30, 40])
  })

  it('downsamples a 4x4 ramp to 2x2', () => {
    const src = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255])
    const out = bilinearResize(src, 4, 4, 2, 2)
    expect(out.length).toBe(4)
    // Top row sees row indices 0 and 2 (boundary) — close to 0/255
    expect(out[0]).toBeLessThan(128)
    expect(out[2]).toBeGreaterThan(128)
  })

  it('upsamples a 2x2 to 4x4 with smooth interpolation', () => {
    const src = new Uint8Array([0, 255, 0, 255])
    const out = bilinearResize(src, 2, 2, 4, 4)
    expect(out.length).toBe(16)
    // First column should track src col 0 = 0, last column should track 255.
    expect(out[0]).toBe(0)
    expect(out[3]).toBe(255)
  })

  it('throws on bad dims', () => {
    expect(() => bilinearResize(new Uint8Array(0), 0, 1, 1, 1)).toThrow(RangeError)
  })
})

describe('composeMaskIntoOriginal', () => {
  it('produces an RGBA buffer at the original dimensions', () => {
    const mask = new Uint8Array(4 * 4).fill(255)
    const out = composeMaskIntoOriginal(mask, 4, 4, 8, 8, { sx: 2, sy: 2, sw: 4, sh: 4 })
    expect(out.width).toBe(8)
    expect(out.height).toBe(8)
    expect(out.data.length).toBe(8 * 8 * 4)
  })

  it('leaves pixels outside the crop window fully transparent', () => {
    const mask = new Uint8Array(2 * 2).fill(255)
    const out = composeMaskIntoOriginal(mask, 2, 2, 4, 4, { sx: 1, sy: 1, sw: 2, sh: 2 })
    // (0, 0) is outside the crop → alpha must be 0.
    const cornerAlpha = out.data[(0 * 4 + 0) * 4 + 3]
    expect(cornerAlpha).toBe(0)
  })

  it('places the mask inside the crop window with foreground white', () => {
    const mask = new Uint8Array(2 * 2).fill(200)
    const out = composeMaskIntoOriginal(mask, 2, 2, 4, 4, { sx: 1, sy: 1, sw: 2, sh: 2 })
    // pixel (2, 2) is inside the crop (dst y=1 row, x=1 col).
    const idx = (2 * 4 + 2) * 4
    expect(out.data[idx + 0]).toBe(255) // R
    expect(out.data[idx + 1]).toBe(255) // G
    expect(out.data[idx + 2]).toBe(255) // B
    expect(out.data[idx + 3]).toBe(200) // A from mask
  })
})

describe('refineAlpha', () => {
  it('clips low-alpha halo to fully transparent', () => {
    // Anything <= cutoff*255 (default 0.22*255 ≈ 56.1) maps to 0; the
    // contrast curve flattens just-past-cutoff values further until a
    // hand-off point around (cutoff + 1/contrast/2) * 255 ≈ 0.50 → 80 or so.
    const out = refineAlpha(new Uint8Array([0, 20, 40, 50]))
    expect(Array.from(out)).toEqual([0, 0, 0, 0])
    // A pixel well past the kill zone should produce a non-zero output.
    const past = refineAlpha(new Uint8Array([90]))
    expect(past[0]).toBeGreaterThan(0)
  })

  it('saturates near-opaque alpha to 255', () => {
    const out = refineAlpha(new Uint8Array([210, 230, 245, 255]))
    expect(Array.from(out)).toEqual([255, 255, 255, 255])
  })

  it('keeps the midpoint unchanged with default contrast', () => {
    const out = refineAlpha(new Uint8Array([128]))
    // 128/255 ≈ 0.502; centred contrast leaves it ≈ 128 (within rounding)
    expect(out[0]).toBeGreaterThan(125)
    expect(out[0]).toBeLessThan(132)
  })

  it('acts as identity when cutoff=0 and contrast=1', () => {
    const input = new Uint8Array([0, 30, 60, 100, 200, 255])
    const out = refineAlpha(input, { cutoff: 0, contrast: 1 })
    expect(Array.from(out)).toEqual(Array.from(input))
  })
})

/**
 * Test helpers for decontaminateEdges — build small RGBA buffers that
 * mimic the "subject island + outer red ring + soft hair edge" pattern
 * that triggers the bug in the wild.
 */
function makeRing(
  width: number,
  height: number,
  config: {
    subjectColor: [number, number, number]
    bgColor: [number, number, number]
    subjectRect: { x: number; y: number; w: number; h: number }
    edgeRing?: { thickness: number; alpha: number }
  },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  const { subjectColor: fg, bgColor: bg, subjectRect, edgeRing } = config
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const insideSubject =
        x >= subjectRect.x &&
        x < subjectRect.x + subjectRect.w &&
        y >= subjectRect.y &&
        y < subjectRect.y + subjectRect.h
      // Distance from the subject's outer boundary (positive outside).
      const dx = Math.max(subjectRect.x - x, x - (subjectRect.x + subjectRect.w - 1), 0)
      const dy = Math.max(subjectRect.y - y, y - (subjectRect.y + subjectRect.h - 1), 0)
      const dist = Math.max(dx, dy)
      if (insideSubject) {
        data[idx + 0] = fg[0]
        data[idx + 1] = fg[1]
        data[idx + 2] = fg[2]
        data[idx + 3] = 255
      } else if (edgeRing && dist <= edgeRing.thickness) {
        const alpha = edgeRing.alpha
        const t = alpha / 255
        // The composited RGB at a soft-edge pixel is what `destination-in`
        // would leave behind: original photo RGB (bg here) blended onto
        // the subject by the matte. We approximate that as the mixed
        // colour straight up, which is the realistic shape the
        // decontaminator faces.
        data[idx + 0] = Math.round(fg[0] * t + bg[0] * (1 - t))
        data[idx + 1] = Math.round(fg[1] * t + bg[1] * (1 - t))
        data[idx + 2] = Math.round(fg[2] * t + bg[2] * (1 - t))
        data[idx + 3] = alpha
      } else {
        data[idx + 0] = bg[0]
        data[idx + 1] = bg[1]
        data[idx + 2] = bg[2]
        data[idx + 3] = 0
      }
    }
  }
  return data
}

describe('estimateOuterRingBg', () => {
  it('returns the surrounding background colour when present', () => {
    const data = makeRing(16, 16, {
      subjectColor: [10, 220, 30],
      bgColor: [200, 40, 50],
      subjectRect: { x: 6, y: 6, w: 4, h: 4 },
    })
    const bg = estimateOuterRingBg(data, 16, 16, { radius: 3 })
    expect(bg).not.toBeNull()
    expect(bg!.r).toBeGreaterThan(180)
    expect(bg!.g).toBeLessThan(80)
    expect(bg!.b).toBeLessThan(80)
  })

  it('returns null when there is no transparent ring (fully opaque buffer)', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100
      data[i + 1] = 100
      data[i + 2] = 100
      data[i + 3] = 255
    }
    expect(estimateOuterRingBg(data, 8, 8)).toBeNull()
  })

  it('returns null when there is no opaque subject', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4)
    // Every pixel transparent (would-be background only).
    expect(estimateOuterRingBg(data, 8, 8)).toBeNull()
  })
})

describe('decontaminateEdges', () => {
  it('recovers the subject colour from semi-alpha pixels contaminated by red bg', () => {
    const data = makeRing(20, 20, {
      subjectColor: [50, 50, 50],
      bgColor: [220, 30, 30],
      subjectRect: { x: 8, y: 8, w: 4, h: 4 },
      edgeRing: { thickness: 1, alpha: 128 },
    })
    // A soft-edge pixel sits directly to the right of the subject at
    // (12, 9). It currently reads as a heavy red blend.
    const idx = (9 * 20 + 12) * 4
    expect(data[idx + 0]).toBeGreaterThan(120)
    expect(data[idx + 1]).toBeLessThan(60)

    const result = decontaminateEdges(data, 20, 20, { radius: 4 })
    expect(result.applied).toBeGreaterThan(0)
    expect(result.bg).not.toBeNull()
    // After unmix the same pixel should read close to the pure subject.
    expect(data[idx + 0]).toBeLessThan(90)
    expect(data[idx + 1]).toBeLessThan(90)
    expect(data[idx + 2]).toBeLessThan(90)
    // Alpha is left untouched.
    expect(data[idx + 3]).toBe(128)
  })

  it('is a no-op on fully opaque and fully transparent pixels', () => {
    const data = new Uint8ClampedArray([
      // (0,0) opaque grey
      120, 120, 120, 255,
      // (1,0) transparent — leftover red
      200, 30, 40, 0,
    ])
    const snapshot = Array.from(data)
    decontaminateEdges(data, 2, 1, { bg: { r: 200, g: 30, b: 40 } })
    expect(Array.from(data)).toEqual(snapshot)
  })

  it('skips when no outer-ring sample is available (no bg estimate)', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    // All opaque grey — nothing to sample.
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100
      data[i + 1] = 100
      data[i + 2] = 100
      data[i + 3] = 255
    }
    const snapshot = Array.from(data)
    const result = decontaminateEdges(data, 4, 4)
    expect(result.applied).toBe(0)
    expect(result.bg).toBeNull()
    expect(Array.from(data)).toEqual(snapshot)
  })

  it('handles gradient bg without crashing — bg estimate stays in range and pixels stay finite', () => {
    const width = 24
    const height = 24
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const insideSubject = x >= 10 && x < 14 && y >= 10 && y < 14
        if (insideSubject) {
          data[idx + 0] = 30
          data[idx + 1] = 30
          data[idx + 2] = 30
          data[idx + 3] = 255
        } else {
          // Horizontal red→blue gradient as the original bg.
          const t = x / (width - 1)
          data[idx + 0] = Math.round(220 * (1 - t))
          data[idx + 1] = 40
          data[idx + 2] = Math.round(220 * t)
          data[idx + 3] = 0
        }
      }
    }
    // Plant a soft-edge ring of alpha=128 with the gradient blended in.
    for (const [x, y] of [
      [14, 10],
      [14, 11],
      [14, 12],
      [14, 13],
    ] as const) {
      const idx = (y * width + x) * 4
      const t = x / (width - 1)
      const bgR = Math.round(220 * (1 - t))
      const bgB = Math.round(220 * t)
      // 50% mix between subject (30,30,30) and gradient bg.
      data[idx + 0] = Math.round(0.5 * 30 + 0.5 * bgR)
      data[idx + 1] = Math.round(0.5 * 30 + 0.5 * 40)
      data[idx + 2] = Math.round(0.5 * 30 + 0.5 * bgB)
      data[idx + 3] = 128
    }
    const result = decontaminateEdges(data, width, height, { radius: 4 })
    expect(result.applied).toBeGreaterThan(0)
    expect(result.bg).not.toBeNull()
    // Every RGB byte stays in [0, 255] (no NaN / wraparound from the
    // unmix division).
    for (let i = 0; i < data.length; i++) {
      expect(Number.isFinite(data[i]!)).toBe(true)
      expect(data[i]!).toBeGreaterThanOrEqual(0)
      expect(data[i]!).toBeLessThanOrEqual(255)
    }
  })
})

describe('postprocessMask end-to-end', () => {
  it('runs a 4x4 float mask through to a 16x16 RGBA buffer', () => {
    const modelOut = new Float32Array(4 * 4).fill(0.5)
    const out = postprocessMask(modelOut, 16, 16, { sx: 4, sy: 4, sw: 8, sh: 8 }, 4)
    expect(out.width).toBe(16)
    expect(out.height).toBe(16)
    // Center pixel should be inside the crop and have alpha ≈ 128.
    const idx = (8 * 16 + 8) * 4
    expect(out.data[idx + 3]).toBeGreaterThan(120)
    expect(out.data[idx + 3]).toBeLessThan(135)
  })

  it('rejects mismatched model output sizes', () => {
    expect(() =>
      postprocessMask(new Float32Array(10), 16, 16, { sx: 0, sy: 0, sw: 16, sh: 16 }, 4),
    ).toThrow(RangeError)
  })
})

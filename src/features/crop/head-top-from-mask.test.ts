import { describe, expect, it } from 'vitest'

import { findHeadTopFromMask } from '@/features/crop/head-top-from-mask'
import type { FaceDetection } from '@/types/spec'

/**
 * Build a synthetic alpha mask of size `w × h` and stamp a filled
 * rectangle of foreground (alpha=255). All other pixels stay
 * transparent. Mirrors the shape MODNet emits — RGBA with alpha in
 * the last channel, RGB ignored.
 */
function buildMask(
  w: number,
  h: number,
  rect: { x: number; y: number; w: number; h: number },
): ImageData {
  const data = new Uint8ClampedArray(w * h * 4)
  const x1 = Math.min(w, rect.x + rect.w)
  const y1 = Math.min(h, rect.y + rect.h)
  for (let y = Math.max(0, rect.y); y < y1; y++) {
    for (let x = Math.max(0, rect.x); x < x1; x++) {
      const i = (y * w + x) * 4
      data[i + 3] = 255
    }
  }
  return new ImageData(data, w, h)
}

function faceAt(bbox: { x: number; y: number; w: number; h: number }): FaceDetection {
  return {
    bbox,
    keypoints: [],
    confidence: 0.9,
  }
}

describe('findHeadTopFromMask', () => {
  it('returns the y of the first row carrying foreground inside the face bbox window', () => {
    // 200×400 mask with a head silhouette starting at y=50.
    const mask = buildMask(200, 400, { x: 60, y: 50, w: 80, h: 300 })
    const face = faceAt({ x: 60, y: 100, w: 80, h: 150 })
    const headTop = findHeadTopFromMask(mask, 200, 400, face)
    expect(headTop).toBe(50)
  })

  it('scales the y back to image-pixel space when the mask is downsampled', () => {
    // Mask is 200×400 but represents a 1000×2000 source image (×5 scale).
    const mask = buildMask(200, 400, { x: 60, y: 50, w: 80, h: 300 })
    const face = faceAt({ x: 300, y: 500, w: 400, h: 750 })
    const headTop = findHeadTopFromMask(mask, 1000, 2000, face)
    // Mask row 50 × (2000 / 400) = 250 image px.
    expect(headTop).toBe(250)
  })

  it('ignores foreground pixels outside the (expanded) face bbox window', () => {
    // A stray dot far to the left at y=5 — should be skipped because
    // it's outside the bbox-expand window. The real head sits at y=50.
    const mask = buildMask(200, 400, { x: 60, y: 50, w: 80, h: 300 })
    // Drop a single high opaque pixel at (5, 5).
    mask.data[(5 * 200 + 5) * 4 + 3] = 255
    const face = faceAt({ x: 60, y: 100, w: 80, h: 150 })
    const headTop = findHeadTopFromMask(mask, 200, 400, face)
    expect(headTop).toBe(50)
  })

  it('returns null when the mask is empty', () => {
    const mask = new ImageData(new Uint8ClampedArray(200 * 400 * 4), 200, 400)
    const face = faceAt({ x: 60, y: 100, w: 80, h: 150 })
    const headTop = findHeadTopFromMask(mask, 200, 400, face)
    expect(headTop).toBeNull()
  })

  it('scans the entire width when no face is provided', () => {
    const mask = buildMask(200, 400, { x: 5, y: 20, w: 30, h: 300 })
    const headTop = findHeadTopFromMask(mask, 200, 400, null)
    expect(headTop).toBe(20)
  })

  it('respects `minPixels` so single-pixel noise is ignored', () => {
    // Lone speck at y=10 — below minPixels threshold. Real head at y=50.
    const mask = buildMask(200, 400, { x: 60, y: 50, w: 80, h: 300 })
    mask.data[(10 * 200 + 100) * 4 + 3] = 255
    const face = faceAt({ x: 60, y: 100, w: 80, h: 150 })
    const headTop = findHeadTopFromMask(mask, 200, 400, face, { minPixels: 3 })
    expect(headTop).toBe(50)
  })

  it('honours a smaller alpha threshold so soft alpha edges still count', () => {
    const w = 200
    const h = 400
    const data = new Uint8ClampedArray(w * h * 4)
    // Stamp a row of alpha=64 at y=20 (soft edge), full rows below from y=40.
    for (let x = 60; x < 140; x++) data[(20 * w + x) * 4 + 3] = 64
    for (let y = 40; y < 200; y++) {
      for (let x = 60; x < 140; x++) data[(y * w + x) * 4 + 3] = 255
    }
    const mask = new ImageData(data, w, h)
    const face = faceAt({ x: 60, y: 100, w: 80, h: 150 })
    const lax = findHeadTopFromMask(mask, w, h, face, { threshold: 32 })
    const strict = findHeadTopFromMask(mask, w, h, face, { threshold: 200 })
    expect(lax).toBe(20)
    expect(strict).toBe(40)
  })
})

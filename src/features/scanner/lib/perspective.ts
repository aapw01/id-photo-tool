/**
 * Pure-JS perspective transform — a focused hand-port of the two
 * OpenCV routines Pixfit Scanner used to call into a 10 MB
 * opencv.js bundle for:
 *
 *   - `cv::getPerspectiveTransform(src, dst)`:
 *       4-point correspondences ⇒ 3×3 forward homography. Implemented
 *       as an 8×8 Gaussian-elimination solve with partial pivoting,
 *       identical to OpenCV's `imgwarp.cpp::getPerspectiveTransform`.
 *
 *   - `cv::warpPerspective(src, dst, M, size, INTER_LINEAR,
 *                          BORDER_REPLICATE)`:
 *       dst → src inverse mapping with 4-tap bilinear interpolation,
 *       borders clamped to the nearest valid source pixel. Same
 *       numeric recipe as OpenCV's `warpPerspectiveLine` SIMD loop,
 *       just walked with plain JS.
 *
 * Why hand-port instead of staying on OpenCV.js: Scanner only ever
 * used these two functions, and the WASM bundle's parse + compile
 * stalled the main thread for 0.5–2 s. After dropping it, a 300 DPI
 * ID-card warp is a ~150–400 ms pixel loop — well inside our
 * interaction budget, and still moves to a Web Worker so the main
 * thread sees nothing.
 *
 * No DOM, no `'use client'`: this file is imported by both the main
 * thread and the warp worker.
 */

import type { Quad } from './detect-corners'

/**
 * Row-major 3×3 homography (`H[8]` normalized to 1 by convention).
 * The forward map sends source pixels to destination pixels.
 */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

/**
 * Solve `src → dst` for the 3×3 homography that satisfies all 4
 * point correspondences (TL, TR, BR, BL).
 *
 * Each correspondence yields two linear constraints on the 8 unknown
 * coefficients; the 9th (`H[8]`) is fixed to 1 by convention. The
 * resulting 8×8 system is solved via partial-pivot Gaussian
 * elimination — same approach as OpenCV.
 *
 * Throws on degenerate input (collinear points / zero-area quad).
 */
export function getPerspectiveTransform(src: Quad, dst: Quad): Mat3 {
  const sp = quadToFlat(src)
  const dp = quadToFlat(dst)

  // Augmented 8×9 matrix [A | b], laid out row by row.
  const m: number[][] = new Array(8)
  for (let i = 0; i < 4; i++) {
    const sx = sp[i * 2]!
    const sy = sp[i * 2 + 1]!
    const dx = dp[i * 2]!
    const dy = dp[i * 2 + 1]!
    m[i * 2] = [sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx, dx]
    m[i * 2 + 1] = [0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy, dy]
  }

  for (let col = 0; col < 8; col++) {
    // Partial pivot: swap the row with the largest |value| in this
    // column into the pivot position. Stabilizes the elimination
    // when one of the corners is near-axis-aligned.
    let pivot = col
    let pivotVal = Math.abs(m[col]![col]!)
    for (let row = col + 1; row < 8; row++) {
      const v = Math.abs(m[row]![col]!)
      if (v > pivotVal) {
        pivot = row
        pivotVal = v
      }
    }
    if (pivotVal < 1e-12) {
      throw new Error('getPerspectiveTransform: degenerate quad (collinear corners)')
    }
    if (pivot !== col) {
      const tmp = m[col]!
      m[col] = m[pivot]!
      m[pivot] = tmp
    }
    const pivotRow = m[col]!
    const pivotEntry = pivotRow[col]!
    for (let row = col + 1; row < 8; row++) {
      const target = m[row]!
      const factor = target[col]! / pivotEntry
      if (factor === 0) continue
      for (let k = col; k < 9; k++) {
        target[k] = target[k]! - factor * pivotRow[k]!
      }
    }
  }

  const h = new Array<number>(8)
  for (let row = 7; row >= 0; row--) {
    let acc = m[row]![8]!
    for (let k = row + 1; k < 8; k++) {
      acc -= m[row]![k]! * h[k]!
    }
    h[row] = acc / m[row]![row]!
  }

  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1]
}

/**
 * 3×3 inverse via cofactor / adjugate. Used to flip a `src → dst`
 * forward homography into the `dst → src` inverse map that
 * `warpPerspectiveBilinear` walks pixel-by-pixel.
 *
 * Throws if the matrix is singular (det ≈ 0) — only possible for a
 * degenerate forward map, which `getPerspectiveTransform` should
 * have already rejected.
 */
export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const D = -(b * i - c * h)
  const E = a * i - c * g
  const F = -(a * h - b * g)
  const G = b * f - c * e
  const H = -(a * f - c * d)
  const I = a * e - b * d
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-12) {
    throw new Error('invert3: singular matrix')
  }
  const inv = 1 / det
  return [A * inv, D * inv, G * inv, B * inv, E * inv, H * inv, C * inv, F * inv, I * inv]
}

/**
 * Apply a forward homography (`src → dst`) to every pixel of a
 * destination canvas of size `dstWidth × dstHeight`, sampling the
 * source by bilinear interpolation with BORDER_REPLICATE clamping.
 *
 * The implementation inverts the supplied forward map once and then
 * walks dst pixel-by-pixel. Per row, the linear part of the inverse
 * is precomputed so the inner loop is just three multiplies + an
 * add per pixel before the 4-tap sample.
 *
 * Returns a fresh `ImageData` — caller owns the buffer.
 */
export function warpPerspectiveBilinear(
  src: ImageData,
  forward: Mat3,
  dstWidth: number,
  dstHeight: number,
): ImageData {
  const [i0, i1, i2, i3, i4, i5, i6, i7, i8] = invert3(forward)
  const sw = src.width
  const sh = src.height
  const sData = src.data
  const out = new Uint8ClampedArray(dstWidth * dstHeight * 4)
  const swMax = sw - 1
  const shMax = sh - 1

  for (let y = 0; y < dstHeight; y++) {
    // Row constants — projecting (x, y, 1) by the inverse splits
    // into `(i0*x + i1*y + i2) / w`-style fractions that share the
    // y-dependent terms across the row.
    const rx = i1 * y + i2
    const ry = i4 * y + i5
    const rw = i7 * y + i8

    for (let x = 0; x < dstWidth; x++) {
      const w = i6 * x + rw
      if (w === 0) continue
      let sx = (i0 * x + rx) / w
      let sy = (i3 * x + ry) / w

      // BORDER_REPLICATE: clamp samples outside the source to the
      // nearest in-bounds pixel. Matches OpenCV's behavior and
      // prevents transparent fringes at the warp boundary when the
      // quad slightly overshoots the bitmap.
      if (sx < 0) sx = 0
      else if (sx > swMax) sx = swMax
      if (sy < 0) sy = 0
      else if (sy > shMax) sy = shMax

      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 < swMax ? x0 + 1 : swMax
      const y1 = y0 < shMax ? y0 + 1 : shMax
      const fx = sx - x0
      const fy = sy - y0
      const wx1 = fx
      const wx0 = 1 - fx
      const wy1 = fy
      const wy0 = 1 - fy

      const off00 = (y0 * sw + x0) * 4
      const off01 = (y0 * sw + x1) * 4
      const off10 = (y1 * sw + x0) * 4
      const off11 = (y1 * sw + x1) * 4
      const dstOff = (y * dstWidth + x) * 4

      // Inlined per-channel bilinear blend. The hot path is 16
      // multiplies + 12 adds per pixel — comparable to what cv's
      // SIMD path achieves before vectorization, and well within
      // budget for ID-card-sized outputs.
      out[dstOff] =
        (sData[off00]! * wx0 + sData[off01]! * wx1) * wy0 +
        (sData[off10]! * wx0 + sData[off11]! * wx1) * wy1
      out[dstOff + 1] =
        (sData[off00 + 1]! * wx0 + sData[off01 + 1]! * wx1) * wy0 +
        (sData[off10 + 1]! * wx0 + sData[off11 + 1]! * wx1) * wy1
      out[dstOff + 2] =
        (sData[off00 + 2]! * wx0 + sData[off01 + 2]! * wx1) * wy0 +
        (sData[off10 + 2]! * wx0 + sData[off11 + 2]! * wx1) * wy1
      out[dstOff + 3] =
        (sData[off00 + 3]! * wx0 + sData[off01 + 3]! * wx1) * wy0 +
        (sData[off10 + 3]! * wx0 + sData[off11 + 3]! * wx1) * wy1
    }
  }

  return new ImageData(out, dstWidth, dstHeight)
}

function quadToFlat(q: Quad): readonly number[] {
  return [
    q.topLeft.x,
    q.topLeft.y,
    q.topRight.x,
    q.topRight.y,
    q.bottomRight.x,
    q.bottomRight.y,
    q.bottomLeft.x,
    q.bottomLeft.y,
  ]
}

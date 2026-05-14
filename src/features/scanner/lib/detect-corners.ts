'use client'

/**
 * Auto-detect the 4 corners of a document inside a bitmap.
 *
 * Pipeline (mirrors the canonical "scanner" recipe):
 *
 *   1. Downscale the source bitmap to a working size with the long
 *      side capped (default 1024 px). Edge detection on a 12 MP phone
 *      capture is needlessly slow and the wider the band the more
 *      false edges Canny finds inside the document text.
 *   2. RGBA → grayscale → 5×5 Gaussian blur → Canny.
 *   3. `findContours` with RETR_EXTERNAL.
 *   4. Sort by area, scan the top-K candidates and run `approxPolyDP`
 *      at progressively looser epsilons until one yields a 4-vertex
 *      convex polygon.
 *   5. Sanity check: the polygon's area must exceed ~10% of the image
 *      area, otherwise we treat the detect as a failure (Canny picked
 *      up a printed photo *inside* the document or similar). Caller
 *      can fall back to the image bounds as identity corners.
 *   6. Order the 4 points clockwise from the top-left so downstream
 *      `warpPerspective` always sees the same vertex ordering.
 *
 * Coordinates returned are in the *original* bitmap pixel space, not
 * the working downscale — so callers can warp the full-resolution
 * image without re-mapping.
 */

import type { CVMat, OpenCV } from './opencv-loader'

const WORK_LONGSIDE_PX = 1024
const TOPK_CONTOURS = 5
const MIN_AREA_RATIO = 0.1

export interface QuadPoint {
  x: number
  y: number
}

export interface Quad {
  topLeft: QuadPoint
  topRight: QuadPoint
  bottomRight: QuadPoint
  bottomLeft: QuadPoint
}

export interface DetectCornersResult {
  /** Detected corners, in the input bitmap's pixel space. */
  quad: Quad
  /** True iff auto-detect succeeded (vs. falling back to image bounds). */
  detected: boolean
}

/**
 * Run the corner detection pipeline. Always returns a `Quad`: when
 * auto-detection fails, falls back to the four image corners so the
 * UI can present a sensible default that the user can drag.
 */
export function detectCorners(cv: OpenCV, bitmap: ImageBitmap): DetectCornersResult {
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > WORK_LONGSIDE_PX ? WORK_LONGSIDE_PX / longest : 1
  const workW = Math.max(1, Math.round(bitmap.width * scale))
  const workH = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = workW
  canvas.height = workH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { quad: imageCorners(bitmap), detected: false }
  }
  ctx.drawImage(bitmap, 0, 0, workW, workH)

  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 75, 200)
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const candidates: { area: number; contour: CVMat }[] = []
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i)
      const area = cv.contourArea(c)
      candidates.push({ area, contour: c })
    }
    candidates.sort((a, b) => b.area - a.area)

    const imageArea = workW * workH
    let bestQuad: Quad | null = null

    for (let i = 0; i < Math.min(TOPK_CONTOURS, candidates.length); i++) {
      const { area, contour } = candidates[i]!
      if (area / imageArea < MIN_AREA_RATIO) break

      const peri = cv.arcLength(contour, true)
      // Try a few epsilons. 0.02 is the canonical OpenCV scanner
      // value; tightening it helps when text inside the document
      // pulls the approximation off; loosening it helps when the
      // document edges are noisy.
      const epsilons = [0.02, 0.03, 0.05, 0.07]
      for (const eps of epsilons) {
        const approx = new cv.Mat()
        try {
          cv.approxPolyDP(contour, approx, peri * eps, true)
          if (approx.rows === 4) {
            const pts = readQuadFromApprox(approx)
            bestQuad = orderClockwise(pts)
            break
          }
        } finally {
          approx.delete()
        }
      }
      if (bestQuad) break
    }

    if (!bestQuad) {
      return { quad: imageCorners(bitmap), detected: false }
    }
    // Scale back into original bitmap pixel space.
    const invScale = 1 / scale
    return {
      quad: scaleQuad(bestQuad, invScale, invScale),
      detected: true,
    }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    contours.delete()
    hierarchy.delete()
  }
}

function readQuadFromApprox(approx: CVMat): QuadPoint[] {
  // OpenCV.js approxPolyDP returns Int32 (x,y) pairs in `data32S`.
  const data = approx.data32S
  return [
    { x: data[0]!, y: data[1]! },
    { x: data[2]!, y: data[3]! },
    { x: data[4]!, y: data[5]! },
    { x: data[6]!, y: data[7]! },
  ]
}

function imageCorners(bitmap: ImageBitmap): Quad {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: bitmap.width, y: 0 },
    bottomRight: { x: bitmap.width, y: bitmap.height },
    bottomLeft: { x: 0, y: bitmap.height },
  }
}

function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  return {
    topLeft: { x: q.topLeft.x * sx, y: q.topLeft.y * sy },
    topRight: { x: q.topRight.x * sx, y: q.topRight.y * sy },
    bottomRight: { x: q.bottomRight.x * sx, y: q.bottomRight.y * sy },
    bottomLeft: { x: q.bottomLeft.x * sx, y: q.bottomLeft.y * sy },
  }
}

/**
 * Order an unordered 4-point polygon as top-left, top-right,
 * bottom-right, bottom-left.
 *
 * The standard trick is to use the per-point sums and differences:
 *   - smallest (x + y) is top-left
 *   - largest  (x + y) is bottom-right
 *   - smallest (y - x) is top-right (small y, large x)
 *   - largest  (y - x) is bottom-left (large y, small x)
 *
 * Exported so the unit test (and the manual corner editor in S3.5)
 * can call it on user-edited points to keep the warp consistent.
 */
export function orderClockwise(points: QuadPoint[]): Quad {
  if (points.length !== 4) {
    throw new Error(`orderClockwise expects 4 points, got ${points.length}`)
  }
  const withMetrics = points.map((p) => ({
    p,
    sum: p.x + p.y,
    diff: p.y - p.x,
  }))
  const tl = withMetrics.reduce((a, b) => (a.sum <= b.sum ? a : b)).p
  const br = withMetrics.reduce((a, b) => (a.sum >= b.sum ? a : b)).p
  const tr = withMetrics.reduce((a, b) => (a.diff <= b.diff ? a : b)).p
  const bl = withMetrics.reduce((a, b) => (a.diff >= b.diff ? a : b)).p
  return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl }
}

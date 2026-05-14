'use client'

/**
 * Quad geometry — the 4-point polygon Scanner uses to describe a
 * document inside a source bitmap.
 *
 * Historical note: this file used to host a Canny + findContours +
 * approxPolyDP auto-detection pipeline (port of an OpenCV recipe). It
 * was retired in favor of a 4-corner manual editor + pure-JS warp
 * because the 10 MB opencv.js dependency was the dominant Scanner
 * load-time cost on slow networks. The geometry helpers (Quad type
 * + clockwise ordering) live on because the corner editor, the warp
 * kernel, and the rectify pipeline all share them.
 *
 * What used to detect corners is now `defaultQuad`: a deterministic
 * starting position centered on the bitmap. The user drags the 4
 * handles to the actual document edges — the same gesture every
 * mature mobile scanner ships (Microsoft Lens, Adobe Scan, etc.).
 */

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

/**
 * Inset ratio for the default quad — picked so the handles sit
 * visibly inside the photo (rather than welded to the edges where
 * they'd be hard to grab) but still gives the user a clear "drag me
 * outward to the document edge" affordance. 6 % is roughly the
 * default offset Microsoft Lens uses when it can't auto-detect.
 */
const DEFAULT_INSET_RATIO = 0.06

/**
 * A sensible starting quad for the manual editor: centered on the
 * source bitmap, inset 6 % from each side. The user drags handles
 * outward (or inward) to align with the actual document edges.
 *
 * Coordinates are in *source bitmap pixel space* so the rectify
 * pipeline can warp the full-resolution image directly.
 */
export function defaultQuad(width: number, height: number): Quad {
  const dx = width * DEFAULT_INSET_RATIO
  const dy = height * DEFAULT_INSET_RATIO
  return {
    topLeft: { x: dx, y: dy },
    topRight: { x: width - dx, y: dy },
    bottomRight: { x: width - dx, y: height - dy },
    bottomLeft: { x: dx, y: height - dy },
  }
}

/**
 * Order an unordered 4-point polygon as top-left, top-right,
 * bottom-right, bottom-left.
 *
 * The standard trick is the per-point sum and difference:
 *   - smallest (x + y) is top-left
 *   - largest  (x + y) is bottom-right
 *   - smallest (y - x) is top-right (small y, large x)
 *   - largest  (y - x) is bottom-left (large y, small x)
 *
 * Called on every "apply" from the corner editor so the warp always
 * receives a consistent winding order, no matter how the user dragged
 * the handles.
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

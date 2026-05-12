/**
 * Millimetre ↔ pixel conversion helpers.
 *
 * Single source of truth for every place we cross the physical /
 * digital boundary: spec data tables, the crop frame's "fit to mm"
 * pinning, the layout renderer (M6), and PDF export. Centralising
 * rounding here keeps the studio and the export pipeline agreeing
 * on dimensions down to the pixel.
 *
 * Convention: 1 inch = 25.4 mm, and we round to the nearest integer
 * pixel (banker's rounding via `Math.round`) because that's what
 * canvas APIs expect.
 */

export const MM_PER_INCH = 25.4

/** Convert millimetres to pixels at a given DPI. Rounded to int. */
export function mmToPx(mm: number, dpi: number): number {
  if (!Number.isFinite(mm) || !Number.isFinite(dpi) || dpi <= 0) {
    throw new Error(`mmToPx: bad input mm=${mm}, dpi=${dpi}`)
  }
  return Math.round((mm * dpi) / MM_PER_INCH)
}

/** Convert pixels to millimetres at a given DPI. Not rounded. */
export function pxToMm(px: number, dpi: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) {
    throw new Error(`pxToMm: bad input px=${px}, dpi=${dpi}`)
  }
  return (px * MM_PER_INCH) / dpi
}

/**
 * Generic spec with physical + DPI fields. Both PhotoSpec and
 * PaperSpec satisfy this — keeping the helper structurally typed
 * means it works on partial spec objects in tests too.
 */
interface PhysicalSpec {
  width_mm: number
  height_mm: number
  dpi: number
  width_px?: number
  height_px?: number
}

/**
 * Return a copy of `spec` with `width_px` / `height_px` filled in.
 * If the spec already provides them, they win (some specs round
 * differently from the canonical formula — e.g. CN ID card uses
 * 358×441 at 350 DPI which doesn't match `Math.round`).
 */
export function derivePixels<T extends PhysicalSpec>(
  spec: T,
): T & {
  width_px: number
  height_px: number
} {
  return {
    ...spec,
    width_px: spec.width_px ?? mmToPx(spec.width_mm, spec.dpi),
    height_px: spec.height_px ?? mmToPx(spec.height_mm, spec.dpi),
  }
}

/** Aspect ratio `width / height` in mm (== px after derivePixels). */
export function aspectRatio(spec: PhysicalSpec): number {
  return spec.width_mm / spec.height_mm
}

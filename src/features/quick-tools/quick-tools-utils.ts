import type { CropFrame } from '@/types/spec'

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** Return the centered source rectangle that fills a target aspect ratio. */
export function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CropRect {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(Number.isFinite)) {
    throw new Error('coverCrop: dimensions must be finite')
  }
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('coverCrop: dimensions must be positive')
  }

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight
  if (sourceRatio > targetRatio) {
    const cropWidth = sourceHeight * targetRatio
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight,
    }
  }

  const cropHeight = sourceWidth / targetRatio
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight,
  }
}

export function positiveInt(value: string, fallback: number, max = 10000): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

export type SizeUnit = 'px' | 'mm' | 'cm' | 'in'

export function pixelsPerUnit(unit: SizeUnit, dpi: number): number {
  return unit === 'px' ? 1 : dpi / (unit === 'mm' ? 25.4 : unit === 'cm' ? 2.54 : 1)
}

/** Reject invalid or oversized dimensions instead of silently changing the requested size. */
export function dimensionToPixels(value: string, unit: SizeUnit, dpi: number): number | null {
  const dimension = Number(value)
  if (!Number.isFinite(dimension) || dimension <= 0) return null
  if (unit !== 'px' && (!Number.isFinite(dpi) || dpi < 1 || dpi > 1200)) return null
  const pixels = Math.round(dimension * pixelsPerUnit(unit, dpi))
  return pixels >= 1 && pixels <= 10000 ? pixels : null
}

export function pixelsToDimension(pixels: number, unit: SizeUnit, dpi: number): string {
  if (unit === 'px') return String(Math.round(pixels))
  return String(Number((pixels / pixelsPerUnit(unit, dpi)).toFixed(6)))
}

/** Fit a user selection to the requested ratio while preserving its centre and staying in bounds. */
export function fitSelection(
  imageW: number,
  imageH: number,
  targetW: number,
  targetH: number,
  selection: CropFrame | null,
): CropFrame {
  const initial = coverCrop(imageW, imageH, targetW, targetH)
  if (!selection) return { x: initial.sx, y: initial.sy, w: initial.sw, h: initial.sh }
  const aspect = targetW / targetH
  if (
    Math.abs(selection.w / selection.h - aspect) < 1e-10 &&
    selection.x >= 0 &&
    selection.y >= 0 &&
    selection.x + selection.w <= imageW &&
    selection.y + selection.h <= imageH
  ) {
    return selection
  }
  const w = Math.min(selection.w, selection.h * aspect, imageW, imageH * aspect)
  const h = w / aspect
  return {
    x: Math.max(0, Math.min(imageW - w, selection.x + (selection.w - w) / 2)),
    y: Math.max(0, Math.min(imageH - h, selection.y + (selection.h - h) / 2)),
    w,
    h,
  }
}

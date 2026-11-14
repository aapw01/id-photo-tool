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

'use client'

/**
 * Output mode post-processing — operates on the rectified blob from
 * `warp-perspective.ts` to produce the final image the user sees and
 * downloads.
 *
 * Three modes (each runs in pure 2D Canvas — no OpenCV.js required,
 * so toggling between them is millisecond-cheap and never has to
 * pay the script-load cost):
 *
 *   scan    — gentle per-channel contrast stretch (auto white-balance
 *             at 2 % / 98 % percentiles). Preserves color so the
 *             output still looks like a scanner with a color drum.
 *
 *   copy    — grayscale + global threshold around 175. Mimics a B&W
 *             photocopier; the canonical look every government office
 *             accepts. (V1.1 will swap in Sauvola adaptive threshold
 *             for unevenly lit captures.)
 *
 *   enhance — saturation × 1.30 + contrast × 1.15. Useful when the
 *             phone capture is dim or hazy. Keeps it color.
 *
 * Return shape mirrors warp-perspective: a `Blob` + width + height
 * tuple, ready for `<img>` preview or the S5 PDF embed.
 */

export type OutputMode = 'scan' | 'copy' | 'enhance'

export interface RenderedOutput {
  blob: Blob
  width: number
  height: number
  mode: OutputMode
}

/**
 * Apply `mode` to an already-rectified color image. Decodes the
 * input via `createImageBitmap`, runs the pixel pass, re-encodes as
 * PNG. The bitmap is closed immediately so no GPU memory is held.
 */
export async function renderOutputMode(input: Blob, mode: OutputMode): Promise<RenderedOutput> {
  const bitmap = await createImageBitmap(input)
  try {
    const { width, height } = bitmap
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('renderOutputMode: failed to create 2d context')
    ctx.drawImage(bitmap, 0, 0)
    const data = ctx.getImageData(0, 0, width, height)
    applyMode(data, mode)
    ctx.putImageData(data, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('renderOutputMode: toBlob returned null'))),
        'image/png',
      )
    })
    return { blob, width, height, mode }
  } finally {
    bitmap.close?.()
  }
}

/**
 * Pure pixel-pass — exposed so tests can drive the kernel without
 * needing a real canvas. Mutates `data.data` in place.
 */
export function applyMode(data: ImageData, mode: OutputMode): void {
  switch (mode) {
    case 'scan':
      applyScan(data)
      return
    case 'copy':
      applyCopy(data)
      return
    case 'enhance':
      applyEnhance(data)
      return
    default: {
      const exhaustive: never = mode
      throw new Error(`renderOutputMode: unknown mode ${exhaustive as string}`)
    }
  }
}

/**
 * Per-channel percentile-based contrast stretch (auto white-balance).
 * Picks the 2nd / 98th percentile per channel so a few stray dark or
 * bright pixels don't drag the stretch — then linearly remaps that
 * span to [0, 255]. Mild but visibly cleaner than the raw warp.
 */
function applyScan(image: ImageData): void {
  const data = image.data
  const len = data.length
  const histR = new Uint32Array(256)
  const histG = new Uint32Array(256)
  const histB = new Uint32Array(256)
  for (let i = 0; i < len; i += 4) {
    histR[data[i]!]!++
    histG[data[i + 1]!]!++
    histB[data[i + 2]!]!++
  }
  const total = len >> 2
  const [rLo, rHi] = percentileBounds(histR, total, 0.02, 0.98)
  const [gLo, gHi] = percentileBounds(histG, total, 0.02, 0.98)
  const [bLo, bHi] = percentileBounds(histB, total, 0.02, 0.98)
  for (let i = 0; i < len; i += 4) {
    data[i] = stretch(data[i]!, rLo, rHi)
    data[i + 1] = stretch(data[i + 1]!, gLo, gHi)
    data[i + 2] = stretch(data[i + 2]!, bLo, bHi)
  }
}

/**
 * Grayscale + global threshold, post auto-WB. 175 sits a bit above
 * 50 % gray so backgrounds get pushed to pure white while ink
 * survives. Good enough for the V1; V1.1 brings adaptive threshold.
 */
function applyCopy(image: ImageData): void {
  applyScan(image)
  const data = image.data
  const len = data.length
  for (let i = 0; i < len; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const v = lum > 175 ? 255 : 0
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

/**
 * Saturation × 1.30 + contrast × 1.15.
 *
 * Saturation: per-pixel offset around the mean of R/G/B. Cheap
 * approximation of HSL saturation but visually indistinguishable
 * at this magnitude.
 *
 * Contrast: linear stretch around 128.
 */
function applyEnhance(image: ImageData): void {
  const data = image.data
  const len = data.length
  const sat = 1.3
  const contrast = 1.15
  for (let i = 0; i < len; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const m = (r + g + b) / 3
    const sR = (r - m) * sat + m
    const sG = (g - m) * sat + m
    const sB = (b - m) * sat + m
    data[i] = clamp((sR - 128) * contrast + 128)
    data[i + 1] = clamp((sG - 128) * contrast + 128)
    data[i + 2] = clamp((sB - 128) * contrast + 128)
  }
}

function percentileBounds(
  histogram: Uint32Array,
  total: number,
  lo: number,
  hi: number,
): [number, number] {
  const loTarget = total * lo
  const hiTarget = total * hi
  let acc = 0
  let loBin = 0
  let hiBin = 255
  for (let i = 0; i < 256; i++) {
    acc += histogram[i]!
    if (acc >= loTarget) {
      loBin = i
      break
    }
  }
  acc = 0
  for (let i = 0; i < 256; i++) {
    acc += histogram[i]!
    if (acc >= hiTarget) {
      hiBin = i
      break
    }
  }
  if (hiBin <= loBin) hiBin = Math.min(255, loBin + 1)
  return [loBin, hiBin]
}

function stretch(v: number, lo: number, hi: number): number {
  const span = hi - lo
  if (span <= 0) return v
  return clamp(((v - lo) / span) * 255)
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

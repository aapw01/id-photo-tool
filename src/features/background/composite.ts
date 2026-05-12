/**
 * Background compositing — the heart of M3.
 *
 * Two complementary functions:
 *
 *   - `compositeIntoImageData(orig, mask, bg, out?)` is a pure pixel-
 *     space function. Mask alpha is multiplied into the original alpha,
 *     and a solid-color background (if any) is alpha-blended underneath.
 *     Easy to unit-test, no DOM needed.
 *
 *   - `extractForeground(bitmap, maskImageData)` and `compositeOnto(
 *     ctx, foreground, bg)` are the canvas-2D helpers used by the live
 *     preview. They cache the "subject cut out on transparent" bitmap
 *     so flipping the background colour is just a pair of `drawImage`
 *     calls — the destination-in cut-out is paid once.
 *
 * Performance contract (TECH_DESIGN §5.3.3): a background swap should
 * cost < 30 ms on commodity hardware; the cached-foreground path keeps
 * it well under that.
 */

/** A background choice: either transparent or a CSS hex colour. */
export type BgColor = { kind: 'transparent' } | { kind: 'color'; hex: string }

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/**
 * Parse `#RGB`, `#RRGGBB`, `RGB`, or `RRGGBB` into an {r, g, b} triple.
 * Returns null when the input is not a valid hex colour — callers should
 * fall back to transparent or surface a UI error.
 */
export function parseHex(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim()
  const m6 = HEX6.exec(trimmed)
  if (m6) {
    return {
      r: parseInt(m6[1]!, 16),
      g: parseInt(m6[2]!, 16),
      b: parseInt(m6[3]!, 16),
    }
  }
  const m3 = HEX3.exec(trimmed)
  if (m3) {
    return {
      r: parseInt(m3[1]! + m3[1]!, 16),
      g: parseInt(m3[2]! + m3[2]!, 16),
      b: parseInt(m3[3]! + m3[3]!, 16),
    }
  }
  return null
}

/** Format `{r,g,b}` back to `#RRGGBB`. */
export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const pad = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${pad(r)}${pad(g)}${pad(b)}`
}

/**
 * Pixel-space composite. Both buffers must already be the same WxH.
 *
 * For each pixel:
 *   final_alpha = orig.A · mask.A / 255
 *
 *   - bg=transparent → output keeps (orig.RGB, final_alpha)
 *   - bg=color       → blend over solid (bgR, bgG, bgB) at final_alpha;
 *                       output alpha is 255 (fully opaque)
 *
 * Mutates `out` in place when supplied, otherwise allocates a fresh
 * Uint8ClampedArray. Returning the buffer lets callers chain.
 */
export function compositeIntoImageData(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  bg: BgColor,
  out?: Uint8ClampedArray,
): Uint8ClampedArray {
  if (orig.length !== mask.length) {
    throw new Error(`composite: mismatched buffers (orig=${orig.length}, mask=${mask.length})`)
  }
  const dst = out ?? new Uint8ClampedArray(orig.length)
  if (dst.length !== orig.length) {
    throw new Error(`composite: out buffer length mismatch (${dst.length})`)
  }

  if (bg.kind === 'transparent') {
    for (let i = 0; i < orig.length; i += 4) {
      dst[i] = orig[i]!
      dst[i + 1] = orig[i + 1]!
      dst[i + 2] = orig[i + 2]!
      const origA = orig[i + 3] ?? 0
      const maskA = mask[i + 3] ?? 0
      dst[i + 3] = Math.round((origA * maskA) / 255)
    }
    return dst
  }

  const rgb = parseHex(bg.hex)
  if (!rgb) {
    throw new Error(`composite: invalid hex "${bg.hex}"`)
  }
  for (let i = 0; i < orig.length; i += 4) {
    const origR = orig[i]!
    const origG = orig[i + 1]!
    const origB = orig[i + 2]!
    const origA = orig[i + 3] ?? 0
    const maskA = mask[i + 3] ?? 0
    // Normalize once; multiplying then dividing twice loses precision.
    const a = (origA * maskA) / (255 * 255)
    const inv = 1 - a
    dst[i] = Math.round(origR * a + rgb.r * inv)
    dst[i + 1] = Math.round(origG * a + rgb.g * inv)
    dst[i + 2] = Math.round(origB * a + rgb.b * inv)
    dst[i + 3] = 255
  }
  return dst
}

/**
 * Apply the segmentation matte while the original photo's RGB is still
 * available. This is the only point where edge pixels can be reliably
 * decontaminated: after canvas `destination-in`, fully transparent pixels
 * have already lost the old background colour we need to unmix.
 */
export function applyAlphaMatteToImageData(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  out?: Uint8ClampedArray,
  opts: {
    bg?: { r: number; g: number; b: number }
    radius?: number
    alphaMin?: number
    alphaMax?: number
    spillRadius?: number
    spillStrength?: number
  } = {},
): Uint8ClampedArray {
  const total = width * height
  if (width <= 0 || height <= 0) {
    throw new RangeError('applyAlphaMatteToImageData: dimensions must be positive')
  }
  if (orig.length < total * 4 || mask.length < total * 4) {
    throw new Error('applyAlphaMatteToImageData: source buffers are too small')
  }
  const dst = out ?? new Uint8ClampedArray(total * 4)
  if (dst.length < total * 4) {
    throw new Error('applyAlphaMatteToImageData: out buffer is too small')
  }

  const bg = opts.bg ?? estimateBackgroundColor(orig, mask, width, height, opts)
  const alphaMin = opts.alphaMin ?? 8
  const alphaMax = opts.alphaMax ?? 248

  for (let i = 0; i < total; i++) {
    const srcIdx = i * 4
    const maskA = mask[srcIdx + 3] ?? 0
    const origA = orig[srcIdx + 3] ?? 0
    const outA = Math.round((origA * maskA) / 255)
    if (outA <= 0) {
      dst[srcIdx + 0] = 0
      dst[srcIdx + 1] = 0
      dst[srcIdx + 2] = 0
      dst[srcIdx + 3] = 0
      continue
    }

    let r = orig[srcIdx + 0]!
    let g = orig[srcIdx + 1]!
    let b = orig[srcIdx + 2]!
    if (bg && maskA > alphaMin && maskA < alphaMax) {
      const alpha = maskA / 255
      const inv = 1 - alpha
      r = (r - inv * bg.r) / alpha
      g = (g - inv * bg.g) / alpha
      b = (b - inv * bg.b) / alpha
    }

    dst[srcIdx + 0] = clampByte(r)
    dst[srcIdx + 1] = clampByte(g)
    dst[srcIdx + 2] = clampByte(b)
    dst[srcIdx + 3] = outA
  }

  if (bg) {
    suppressEdgeColorSpill(dst, mask, width, height, bg, {
      radius: opts.spillRadius,
      strength: opts.spillStrength,
    })
  }

  return dst
}

function clampByte(value: number): number {
  return value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value)
}

/**
 * Best-effort background colour for matte decontamination. We first ask
 * the mask itself (the ring of near-transparent pixels just outside the
 * subject) — that's the most accurate sample of "the colour that
 * actually leaked into the hair". When the soft mask transition has no
 * near-zero alpha samples (common with FP16 MODNet on letterboxed
 * inputs), fall back to the image corners which on ID photos are
 * reliably plain background.
 */
function estimateBackgroundColor(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  opts: { radius?: number; alphaLow?: number; alphaHigh?: number } = {},
): { r: number; g: number; b: number } | null {
  return (
    estimateMaskOuterRingBg(orig, mask, width, height, opts) ??
    estimateImageCornerBg(orig, mask, width, height)
  )
}

function estimateMaskOuterRingBg(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  opts: { radius?: number; alphaLow?: number; alphaHigh?: number } = {},
): { r: number; g: number; b: number } | null {
  const radius = Math.max(1, Math.floor(opts.radius ?? 6))
  // Slightly permissive cutoff: alpha <= 16 still reads as background.
  // Letterboxed FP16 MODNet leaves few alpha-0 samples around hair, so
  // 12 was too strict to ever fire in practice.
  const alphaLow = opts.alphaLow ?? 16
  const alphaHigh = opts.alphaHigh ?? 240
  const total = width * height

  const subject = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if ((mask[i * 4 + 3] ?? 0) >= alphaHigh) subject[i] = 1
  }

  const horiz = new Uint8Array(total)
  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    let count = 0
    for (let x = 0; x < Math.min(radius + 1, width); x++) {
      count += subject[rowOff + x]!
    }
    for (let x = 0; x < width; x++) {
      horiz[rowOff + x] = count > 0 ? 1 : 0
      const addIdx = x + radius + 1
      if (addIdx < width) count += subject[rowOff + addIdx]!
      const dropIdx = x - radius
      if (dropIdx >= 0) count -= subject[rowOff + dropIdx]!
    }
  }

  const dilated = new Uint8Array(total)
  for (let x = 0; x < width; x++) {
    let count = 0
    for (let y = 0; y < Math.min(radius + 1, height); y++) {
      count += horiz[y * width + x]!
    }
    for (let y = 0; y < height; y++) {
      dilated[y * width + x] = count > 0 ? 1 : 0
      const addY = y + radius + 1
      if (addY < height) count += horiz[addY * width + x]!
      const dropY = y - radius
      if (dropY >= 0) count -= horiz[dropY * width + x]!
    }
  }

  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < total; i++) {
    if (!dilated[i] || subject[i]) continue
    const a = mask[i * 4 + 3] ?? 0
    if (a > alphaLow) continue
    r += orig[i * 4 + 0]!
    g += orig[i * 4 + 1]!
    b += orig[i * 4 + 2]!
    n++
  }

  return n === 0 ? null : { r: r / n, g: g / n, b: b / n }
}

/**
 * Last-resort background sampler: read the four image corners. ID
 * photos are framed so the corners are always plain background, which
 * makes them an excellent fallback when the soft mask never dropped
 * below `alphaLow` near the subject.
 */
function estimateImageCornerBg(
  orig: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  opts: { window?: number; maskAlphaMax?: number } = {},
): { r: number; g: number; b: number } | null {
  const window = Math.max(1, Math.floor(opts.window ?? 16))
  // Allow some softness — the corner doesn't need to be hard transparent
  // for us to trust it as background, but a still-confident-foreground
  // pixel disqualifies it.
  const maskMax = opts.maskAlphaMax ?? 64
  // Require at least half of one corner window to be valid samples
  // before we trust the average. Stops a single misidentified corner
  // from dragging the estimate away from the real background.
  const minSamples = Math.floor(window * window * 0.5)

  const corners: { x0: number; y0: number }[] = [
    { x0: 0, y0: 0 },
    { x0: width - window, y0: 0 },
    { x0: 0, y0: height - window },
    { x0: width - window, y0: height - window },
  ]

  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (const { x0, y0 } of corners) {
    const xStart = Math.max(0, x0)
    const yStart = Math.max(0, y0)
    const xEnd = Math.min(width, x0 + window)
    const yEnd = Math.min(height, y0 + window)
    for (let y = yStart; y < yEnd; y++) {
      const rowOff = y * width
      for (let x = xStart; x < xEnd; x++) {
        const idx = (rowOff + x) * 4
        if ((mask[idx + 3] ?? 0) > maskMax) continue
        r += orig[idx + 0]!
        g += orig[idx + 1]!
        b += orig[idx + 2]!
        n++
      }
    }
  }

  if (n < minSamples) return null
  return { r: r / n, g: g / n, b: b / n }
}

/**
 * Subtract the old background's chroma axis from pixels that sit just
 * inside the foreground/background boundary. This handles the case the
 * alpha-unmix loop above can't reach: high-alpha (>~248) boundary
 * pixels where the model is over-confident about opacity but the RGB
 * still carries the old background's tint — the classic "red halo on
 * dark hair" failure mode.
 */
function suppressEdgeColorSpill(
  rgba: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  opts: { radius?: number; strength?: number } = {},
): void {
  // 18px sweep matches the ~5–8px halo seen on real-device captures
  // plus headroom for blur / resampling around the matte.
  const radius = Math.max(1, Math.floor(opts.radius ?? 18))
  // > 1 lets the pass go all the way to neutral on heavily-tinted
  // pixels; the `amount` clamp below stops it overshooting past that.
  const strength = opts.strength ?? 1.15
  const total = width * height
  const nearBg = buildNearBackgroundMask(mask, width, height, radius)
  const bgLum = luma(bg.r, bg.g, bg.b)
  const bgCr = bg.r - bgLum
  const bgCg = bg.g - bgLum
  const bgCb = bg.b - bgLum
  const bgChroma2 = bgCr * bgCr + bgCg * bgCg + bgCb * bgCb
  // Near-neutral backgrounds (grey/white wall) have no chroma axis to
  // subtract along — running the pass would just be sampling noise.
  if (bgChroma2 < 120) return

  for (let i = 0; i < total; i++) {
    if (!nearBg[i]) continue
    const idx = i * 4
    const alpha = mask[idx + 3] ?? 0
    if (alpha <= 32) continue
    const r = rgba[idx + 0]!
    const g = rgba[idx + 1]!
    const b = rgba[idx + 2]!
    const lum = luma(r, g, b)
    // Keep skin, lips and bright highlights stable. The user-visible
    // failure is the coloured outline on dark hair / dark clothing where
    // MODNet keeps an over-confident boundary pixel.
    if (lum > 165) continue

    // Saturation guard: protect near-neutral pixels (deep hair body,
    // dark fabric, glasses frames) from being shifted off-grey even
    // when they sit within the spill radius.
    const maxCh = r >= g ? (r >= b ? r : b) : g >= b ? g : b
    const minCh = r <= g ? (r <= b ? r : b) : g <= b ? g : b
    const sat = maxCh === 0 ? 0 : (maxCh - minCh) / maxCh
    if (sat < 0.16) continue

    const cr = r - lum
    const cg = g - lum
    const cb = b - lum
    const projection = (cr * bgCr + cg * bgCg + cb * bgCb) / bgChroma2
    if (projection <= 0) continue

    // High-alpha boundary pixels are exactly the case regular matte
    // decontamination misses: alpha says "opaque", RGB still says "old
    // background". Scale the pass by both alpha confidence and boundary
    // darkness so interior hair stays natural.
    const alphaFactor = alpha >= 248 ? 1 : Math.min(1, Math.max(0, (alpha - 32) / 216))
    const darkFactor = Math.min(1, Math.max(0, (165 - lum) / 130))
    const target = projection * strength * alphaFactor * darkFactor
    // Never subtract more chroma than the pixel actually has along the
    // bg axis — overshooting would invent a green/cyan complementary
    // tint at the boundary.
    const amount = target < projection ? target : projection
    if (amount <= 0) continue

    rgba[idx + 0] = clampByte(r - bgCr * amount)
    rgba[idx + 1] = clampByte(g - bgCg * amount)
    rgba[idx + 2] = clampByte(b - bgCb * amount)
  }
}

/**
 * 1 wherever a pixel sits within `radius` of any `mask alpha <= 24`
 * pixel — i.e. near transparent background. Implemented as a two-pass
 * separable dilation so cost is O(W·H), independent of `radius`.
 */
function buildNearBackgroundMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const total = width * height
  const background = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if ((mask[i * 4 + 3] ?? 0) <= 24) background[i] = 1
  }

  const horiz = new Uint8Array(total)
  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    let count = 0
    for (let x = 0; x < Math.min(radius + 1, width); x++) {
      count += background[rowOff + x]!
    }
    for (let x = 0; x < width; x++) {
      horiz[rowOff + x] = count > 0 ? 1 : 0
      const addIdx = x + radius + 1
      if (addIdx < width) count += background[rowOff + addIdx]!
      const dropIdx = x - radius
      if (dropIdx >= 0) count -= background[rowOff + dropIdx]!
    }
  }

  const near = new Uint8Array(total)
  for (let x = 0; x < width; x++) {
    let count = 0
    for (let y = 0; y < Math.min(radius + 1, height); y++) {
      count += horiz[y * width + x]!
    }
    for (let y = 0; y < height; y++) {
      near[y * width + x] = count > 0 ? 1 : 0
      const addY = y + radius + 1
      if (addY < height) count += horiz[addY * width + x]!
      const dropY = y - radius
      if (dropY >= 0) count -= horiz[dropY * width + x]!
    }
  }
  return near
}

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114
}

/* -------------------------------------------------------------------------- */
/* Canvas helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cut the original `bitmap` out by `maskImage` (RGBA where A is the
 * matte) into a fresh ImageBitmap. This bitmap is the cacheable
 * intermediate: every later swap of background colour reuses it.
 *
 * Implementation uses `destination-in` which is GPU-friendly and lets
 * the browser keep the result on the compositor. We pick OffscreenCanvas
 * when available (Workers + modern browsers) and fall back to a regular
 * HTMLCanvasElement otherwise.
 */
export async function extractForeground(
  bitmap: ImageBitmap,
  maskImage: ImageData,
): Promise<ImageBitmap> {
  const { width: w, height: h } = bitmap
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('extractForeground: 2D context unavailable')

  ctx.drawImage(bitmap, 0, 0)

  // Pixel path: read the original photo before alpha application so the
  // old background colour is still available for edge decontamination.
  try {
    const imgData = ctx.getImageData(0, 0, w, h)
    applyAlphaMatteToImageData(imgData.data, maskImage.data, w, h, imgData.data)
    ctx.putImageData(imgData, 0, 0)
  } catch {
    // Some canvases (tainted, restricted offscreen) refuse getImageData.
    // Fall back to the old GPU-friendly path so users still get a cutout.
    const maskCanvas = makeCanvas(maskImage.width, maskImage.height)
    const maskCtx = maskCanvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!maskCtx) throw new Error('extractForeground: mask 2D context unavailable')
    maskCtx.putImageData(maskImage, 0, 0)

    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas as unknown as CanvasImageSource, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
  }

  if (canvas instanceof OffscreenCanvas) {
    return canvas.transferToImageBitmap()
  }
  return createImageBitmap(canvas as HTMLCanvasElement)
}

/**
 * Paint `foreground` over `bg` into the supplied 2D context. The
 * context must already be sized to `(w, h)`. The transparent path
 * clears the canvas; the colour path fills first and then stamps the
 * cached foreground on top — two draw calls regardless of image size.
 */
export function compositeOnto(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  foreground: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  w: number,
  h: number,
  bg: BgColor,
): void {
  ctx.clearRect(0, 0, w, h)
  if (bg.kind === 'color') {
    const rgb = parseHex(bg.hex)
    if (rgb) {
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
      ctx.fillRect(0, 0, w, h)
    }
  }
  ctx.drawImage(foreground as CanvasImageSource, 0, 0, w, h)
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

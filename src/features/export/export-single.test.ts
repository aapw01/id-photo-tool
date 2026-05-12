/**
 * Unit tests for the single-photo export pipeline. happy-dom canvas
 * doesn't actually encode bytes (toBlob returns a synthetic blob with
 * the right mimeType), so the assertions focus on:
 *
 *   1. The right mime type is asked for each format.
 *   2. Alpha is preserved for png-alpha / webp.
 *   3. Cropping at native resolution + final size both work.
 *
 * Real encoder behaviour is covered indirectly by the integration
 * smoke test in /studio (curl gate at the end of the milestone).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { exportSingle, mimeFor, preservesAlpha, type ExportFormat } from './export-single'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeSource(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 200
  c.height = 200
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(255, 0, 0, 1)'
  ctx.fillRect(0, 0, 100, 200)
  ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'
  ctx.fillRect(100, 0, 100, 200)
  return c
}

describe('mimeFor / preservesAlpha', () => {
  const cases: Array<[ExportFormat, string, boolean]> = [
    ['png-alpha', 'image/png', true],
    ['png-flat', 'image/png', false],
    ['jpg', 'image/jpeg', false],
    ['webp', 'image/webp', true],
  ]
  it.each(cases)('%s → %s alpha=%s', (format, mime, alpha) => {
    expect(mimeFor(format)).toBe(mime)
    expect(preservesAlpha(format)).toBe(alpha)
  })
})

describe('exportSingle', () => {
  it('produces a png-alpha blob with image/png mime', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'png-alpha',
      targetPixels: { width: 100, height: 100 },
    })
    expect(r.blob.type).toBe('image/png')
    expect(r.mimeType).toBe('image/png')
    expect(r.width).toBe(100)
    expect(r.height).toBe(100)
  })

  it('produces a png-flat blob that flattens onto the picked colour', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'color', hex: '#10B981' },
      format: 'png-flat',
      targetPixels: { width: 50, height: 50 },
    })
    expect(r.blob.type).toBe('image/png')
    expect(r.width).toBe(50)
  })

  it('produces a jpg blob with image/jpeg mime — even when bg is transparent', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'jpg',
      targetPixels: { width: 80, height: 80 },
    })
    expect(r.blob.type).toBe('image/jpeg')
  })

  it('produces a webp blob with image/webp mime', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'webp',
      targetPixels: { width: 60, height: 60 },
    })
    expect(r.blob.type).toBe('image/webp')
  })

  it('honours the frame crop — output size still equals targetPixels', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'color', hex: '#FFFFFF' },
      format: 'jpg',
      targetPixels: { width: 600, height: 600 },
      frame: { x: 50, y: 50, w: 100, h: 100 },
    })
    expect(r.width).toBe(600)
    expect(r.height).toBe(600)
  })

  it('clamps target dimensions to a positive integer', async () => {
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'png-alpha',
      targetPixels: { width: 0, height: -5 },
    })
    expect(r.width).toBe(1)
    expect(r.height).toBe(1)
  })

  it('uses spec-default quality 0.92 for JPG / 0.85 for WebP when none is given', async () => {
    // We can't easily assert encoder quality from the resulting blob,
    // but we can verify the call is made by spying on toBlob.
    const source = makeSource()
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'jpg',
      targetPixels: { width: 64, height: 64 },
    })
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)

    spy.mockClear()
    await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'webp',
      targetPixels: { width: 64, height: 64 },
    })
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85)
  })

  it('skips the resampler when target dims match source and no frame is set', async () => {
    // Native 20MP-style scenario: target == source dims, no frame. The
    // fast path should still produce a non-empty PNG blob; we don't
    // assert that Pica was untouched (that's an internal optimisation),
    // but the call must succeed quickly without resampling.
    const source = makeSource()
    const r = await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'png-alpha',
      targetPixels: { width: source.width, height: source.height },
    })
    expect(r.blob).toBeInstanceOf(Blob)
    expect(r.blob.size).toBeGreaterThan(0)
    expect(r.width).toBe(source.width)
    expect(r.height).toBe(source.height)
    expect(r.mimeType).toBe('image/png')
  })

  it('overrides the default quality when the caller passes one', async () => {
    const source = makeSource()
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    await exportSingle({
      foreground: source,
      bg: { kind: 'transparent' },
      format: 'jpg',
      targetPixels: { width: 64, height: 64 },
      quality: 0.5,
    })
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.5)
  })
})

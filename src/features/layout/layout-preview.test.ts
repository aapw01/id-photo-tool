// @vitest-environment happy-dom

/**
 * `pickCellSource` — the small contract the LayoutPreview uses to
 * decide what to feed each cell's exportSingle call.
 *
 * The interesting branch is the "mask not ready yet" path: the preview
 * must still surface an image (the raw bitmap on transparent) instead
 * of a row of grey placeholder boxes. Bug #5 in the M8b polish pass.
 */

import { describe, expect, it } from 'vitest'

import type { BgColor } from '@/features/background/composite'

import { paintCellCanvas, pickCellSource } from './layout-preview'

const fakeBitmap = (id: string): ImageBitmap =>
  ({ width: 100, height: 100, __id: id }) as unknown as ImageBitmap

describe('pickCellSource', () => {
  it('uses the cut-out foreground and the user bg when mask is ready', () => {
    const bitmap = fakeBitmap('orig')
    const foreground = fakeBitmap('fg')
    const bg: BgColor = { kind: 'color', hex: '#FFFFFF' }
    const result = pickCellSource(bitmap, foreground, bg)
    expect(result.source).toBe(foreground)
    expect(result.bg).toEqual(bg)
    expect(result.format).toBe('png-flat')
  })

  it('falls back to the raw bitmap on transparent when mask is missing', () => {
    const bitmap = fakeBitmap('orig')
    const bg: BgColor = { kind: 'color', hex: '#2F5BFF' }
    const result = pickCellSource(bitmap, null, bg)
    expect(result.source).toBe(bitmap)
    // Forcing transparent avoids burning `bg` over the whole photo —
    // the user only wanted that on the matted subject, not on the
    // raw uncutout fallback.
    expect(result.bg).toEqual({ kind: 'transparent' })
    expect(result.format).toBe('png-alpha')
  })

  it('respects the user transparent bg when the foreground is ready', () => {
    const bitmap = fakeBitmap('orig')
    const foreground = fakeBitmap('fg')
    const bg: BgColor = { kind: 'transparent' }
    const result = pickCellSource(bitmap, foreground, bg)
    expect(result.source).toBe(foreground)
    expect(result.bg).toEqual({ kind: 'transparent' })
    expect(result.format).toBe('png-flat')
  })
})

describe('paintCellCanvas', () => {
  it('produces a DOM canvas sized to targetPixels', () => {
    const src = document.createElement('canvas')
    src.width = 64
    src.height = 64
    const out = paintCellCanvas(
      src,
      { kind: 'transparent' },
      { x: 0, y: 0, w: 64, h: 64 },
      { width: 80, height: 100 },
    )
    expect(out.tagName).toBe('CANVAS')
    expect(out.width).toBe(80)
    expect(out.height).toBe(100)
  })

  it('fills a solid background colour before drawing the source (recorded ops)', () => {
    const src = document.createElement('canvas')
    src.width = 10
    src.height = 10
    const out = paintCellCanvas(
      src,
      { kind: 'color', hex: '#2F5BFF' },
      { x: 0, y: 0, w: 10, h: 10 },
      { width: 10, height: 10 },
    )
    const ctx = out.getContext('2d') as unknown as {
      __drawCalls?: { method: string; args: unknown[] }[]
      fillStyle?: string
    }
    const calls = ctx.__drawCalls ?? []
    // The fast-path must emit a fillRect before the drawImage so the
    // bg colour shows through transparent regions of the source.
    const methods = calls.map((c) => c.method)
    expect(methods.indexOf('fillRect')).toBeGreaterThanOrEqual(0)
    expect(methods.indexOf('drawImage')).toBeGreaterThan(methods.indexOf('fillRect'))
  })

  it('skips the fill when bg is transparent (alpha-preserving path)', () => {
    const src = document.createElement('canvas')
    src.width = 8
    src.height = 8
    const out = paintCellCanvas(
      src,
      { kind: 'transparent' },
      { x: 0, y: 0, w: 8, h: 8 },
      { width: 8, height: 8 },
    )
    const ctx = out.getContext('2d') as unknown as {
      __drawCalls?: { method: string; args: unknown[] }[]
    }
    const methods = (ctx.__drawCalls ?? []).map((c) => c.method)
    expect(methods).not.toContain('fillRect')
    expect(methods).toContain('drawImage')
  })

  it('clamps frame coords so a zero-area frame still returns a usable canvas', () => {
    const src = document.createElement('canvas')
    src.width = 8
    src.height = 8
    const out = paintCellCanvas(
      src,
      { kind: 'transparent' },
      { x: -1, y: -1, w: 0, h: 0 },
      { width: 4, height: 4 },
    )
    expect(out.width).toBe(4)
    expect(out.height).toBe(4)
  })
})

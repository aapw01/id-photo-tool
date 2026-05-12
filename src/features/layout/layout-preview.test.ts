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

import { pickCellSource } from './layout-preview'

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

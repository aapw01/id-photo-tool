/**
 * `renderLayout` happy path — verifies the canvas is sized to the
 * paper's pixel dimensions, that overflow surfaces correctly, and
 * that missing cell images produce placeholders rather than crashing.
 */

import { describe, expect, it } from 'vitest'

import { getLayoutTemplate } from '@/data/layout-templates'
import { getPaperSpec } from '@/data/paper-specs'
import { getPhotoSpec } from '@/data/photo-specs'

import { renderLayout } from './render-layout'

describe('renderLayout', () => {
  it('produces a canvas sized to the paper resolution', () => {
    const paper = getPaperSpec('5R')!
    const template = getLayoutTemplate('8x1inch-on-5R')!
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => null,
    })
    expect(result.canvas.width).toBe(paper.width_px)
    expect(result.canvas.height).toBe(paper.height_px)
  })

  it('places 8 cells for the 8 × 1-inch template', () => {
    const paper = getPaperSpec('5R')!
    const template = getLayoutTemplate('8x1inch-on-5R')!
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => null,
    })
    expect(result.placed.length).toBe(8)
    expect(result.overflow).toEqual([])
  })

  it('respects a DPI override (preview rendering)', () => {
    const paper = getPaperSpec('5R')!
    const template = getLayoutTemplate('8x1inch-on-5R')!
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => null,
      dpi: 150,
    })
    // At half DPI, canvas should be roughly half size.
    expect(result.canvas.width).toBeLessThan(paper.width_px ?? Infinity)
  })

  it('falls back to placeholders when getCellImage returns null', () => {
    const paper = getPaperSpec('5R')!
    const template = getLayoutTemplate('8x1inch-on-5R')!
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => null,
    })
    expect(result.placed.length).toBe(8)
    const ctx = result.canvas.getContext('2d') as unknown as {
      __drawCalls?: { method: string }[]
    }
    const calls = ctx.__drawCalls ?? []
    expect(calls.filter((c) => c.method === 'drawImage')).toHaveLength(0)
  })

  it('draws each cell when getCellImage returns a real source', () => {
    const paper = getPaperSpec('5R')!
    const template = getLayoutTemplate('8x1inch-on-5R')!
    const fake = document.createElement('canvas')
    fake.width = 100
    fake.height = 140
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => fake,
    })
    expect(result.placed.length).toBe(8)
    const ctx = result.canvas.getContext('2d') as unknown as {
      __drawCalls?: { method: string }[]
    }
    const drawImageCalls = (ctx.__drawCalls ?? []).filter((c) => c.method === 'drawImage')
    expect(drawImageCalls).toHaveLength(8)
  })

  it('surfaces packer overflow', () => {
    const paper = getPaperSpec('5R')!
    const template = {
      ...getLayoutTemplate('8x1inch-on-5R')!,
      items: [{ photoSpecId: 'cn-passport', count: 50 }],
    }
    const result = renderLayout({
      paper,
      template,
      getSpec: (id) => getPhotoSpec(id),
      getCellImage: () => null,
    })
    expect(result.overflow.length).toBe(1)
  })
})

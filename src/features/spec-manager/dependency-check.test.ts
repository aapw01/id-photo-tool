import { describe, expect, it } from 'vitest'

import {
  findDependents,
  findDependentsByPaperSpec,
  findDependentsByPhotoSpec,
} from './dependency-check'
import type { LayoutTemplate } from '@/types/spec'

const tpl = (
  id: string,
  photoSpecIds: string[],
  paperId = 'A4',
  cellIds: string[] = [],
): LayoutTemplate => ({
  id,
  builtin: false,
  paperId,
  name: { zh: id, 'zh-Hant': id, en: id },
  items: photoSpecIds.map((p) => ({ photoSpecId: p, count: 1 })),
  arrangement:
    cellIds.length === 0
      ? { kind: 'auto-grid' }
      : {
          kind: 'manual',
          cells: cellIds.map((p) => ({ photoSpecId: p, x_mm: 0, y_mm: 0 })),
        },
})

describe('findDependentsByPhotoSpec', () => {
  it('returns no templates when nothing depends on the spec', () => {
    const templates = [tpl('t1', ['us-visa'])]
    expect(findDependentsByPhotoSpec('cn-1inch', templates)).toEqual([])
  })

  it('finds a single dependent via items', () => {
    const templates = [tpl('t1', ['us-visa']), tpl('t2', ['cn-1inch'])]
    expect(findDependentsByPhotoSpec('cn-1inch', templates).map((t) => t.id)).toEqual(['t2'])
  })

  it('finds dependents via manual cells too', () => {
    const templates = [tpl('t3', [], 'A4', ['cn-1inch'])]
    expect(findDependentsByPhotoSpec('cn-1inch', templates).map((t) => t.id)).toEqual(['t3'])
  })

  it('returns N dependents when many reference the spec', () => {
    const templates = [
      tpl('t1', ['cn-1inch']),
      tpl('t2', ['cn-1inch', 'us-visa']),
      tpl('t3', ['us-visa']),
      tpl('t4', [], 'A4', ['cn-1inch']),
    ]
    expect(findDependentsByPhotoSpec('cn-1inch', templates).map((t) => t.id)).toEqual([
      't1',
      't2',
      't4',
    ])
  })
})

describe('findDependentsByPaperSpec', () => {
  it('finds templates that print on a paper', () => {
    const templates = [tpl('t1', ['cn-1inch'], 'A4'), tpl('t2', ['cn-1inch'], '6R')]
    expect(findDependentsByPaperSpec('A4', templates).map((t) => t.id)).toEqual(['t1'])
  })

  it('returns no templates when paper is unreferenced', () => {
    const templates = [tpl('t1', ['cn-1inch'], 'A4')]
    expect(findDependentsByPaperSpec('A5', templates)).toEqual([])
  })
})

describe('findDependents (dispatch)', () => {
  it('dispatches to photo / paper variants', () => {
    const templates = [tpl('t1', ['cn-1inch'], 'A4')]
    expect(findDependents({ kind: 'photo', id: 'cn-1inch' }, templates).map((t) => t.id)).toEqual([
      't1',
    ])
    expect(findDependents({ kind: 'paper', id: 'A4' }, templates).map((t) => t.id)).toEqual(['t1'])
    expect(findDependents({ kind: 'paper', id: 'nope' }, templates)).toEqual([])
  })
})

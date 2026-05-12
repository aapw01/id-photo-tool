import { describe, expect, it } from 'vitest'

import {
  createPaperSpec,
  createPhotoSpec,
  deletePaperSpec,
  deletePhotoSpec,
  updatePaperSpec,
  updatePhotoSpec,
} from './crud'
import type { PaperSpec, PhotoSpec } from '@/types/spec'

const userPhoto = (id: string, over: Partial<PhotoSpec> = {}): PhotoSpec => ({
  id,
  builtin: false,
  category: 'custom',
  name: { zh: id, 'zh-Hant': id, en: id },
  width_mm: 35,
  height_mm: 45,
  dpi: 300,
  ...over,
})

const userPaper = (id: string, over: Partial<PaperSpec> = {}): PaperSpec => ({
  id,
  builtin: false,
  name: { zh: id, 'zh-Hant': id, en: id },
  width_mm: 100,
  height_mm: 150,
  dpi: 300,
  ...over,
})

describe('createPhotoSpec', () => {
  it('appends a valid candidate', () => {
    const out = createPhotoSpec([], userPhoto('a'))
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value).toHaveLength(1)
  })

  it('rejects duplicate ids', () => {
    const list = [userPhoto('dup')]
    const out = createPhotoSpec(list, userPhoto('dup'))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('id-conflict')
  })

  it('rejects candidates marked builtin', () => {
    const bad = { ...userPhoto('foo'), builtin: true }
    const out = createPhotoSpec([], bad)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('validation-failed')
  })

  it('rejects schema-invalid candidates (negative dimensions)', () => {
    const bad = { ...userPhoto('foo'), width_mm: -1 }
    const out = createPhotoSpec([], bad)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('validation-failed')
  })

  it('rejects schema-invalid candidates (missing name)', () => {
    const bad = { ...userPhoto('foo'), name: undefined as unknown as PhotoSpec['name'] }
    const out = createPhotoSpec([], bad)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('validation-failed')
  })
})

describe('updatePhotoSpec', () => {
  it('replaces matching entry and pins id', () => {
    const list = [userPhoto('p1'), userPhoto('p2')]
    const out = updatePhotoSpec(list, 'p1', { ...userPhoto('renamed'), width_mm: 40 })
    expect(out.ok).toBe(true)
    if (out.ok) {
      const first = out.value[0]
      expect(first?.id).toBe('p1')
      expect(first?.width_mm).toBe(40)
    }
  })

  it('refuses to update a missing id', () => {
    const out = updatePhotoSpec([], 'nope', userPhoto('nope'))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('not-found')
  })

  it('refuses to update an entry flagged builtin', () => {
    const list: PhotoSpec[] = [{ ...userPhoto('frozen'), builtin: true }]
    const out = updatePhotoSpec(list, 'frozen', userPhoto('frozen', { width_mm: 99 }))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('builtin-protected')
  })

  it('forces builtin flag back to false during update', () => {
    const list = [userPhoto('keep')]
    const out = updatePhotoSpec(list, 'keep', { ...userPhoto('keep'), builtin: true })
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value[0]?.builtin).toBe(false)
  })
})

describe('deletePhotoSpec', () => {
  it('removes the matching entry', () => {
    const list = [userPhoto('a'), userPhoto('b')]
    const out = deletePhotoSpec(list, 'a')
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value.map((p) => p.id)).toEqual(['b'])
  })

  it('refuses to delete builtin entries', () => {
    const list: PhotoSpec[] = [{ ...userPhoto('cn-1inch'), builtin: true }]
    const out = deletePhotoSpec(list, 'cn-1inch')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('builtin-protected')
  })

  it('returns not-found when the id is missing', () => {
    const out = deletePhotoSpec([], 'missing')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('not-found')
  })
})

describe('PaperSpec CRUD', () => {
  it('creates / updates / deletes valid papers', () => {
    let list: PaperSpec[] = []
    const created = createPaperSpec(list, userPaper('p1'))
    expect(created.ok).toBe(true)
    if (created.ok) list = created.value

    const updated = updatePaperSpec(list, 'p1', userPaper('p1', { width_mm: 200 }))
    expect(updated.ok).toBe(true)
    if (updated.ok) {
      list = updated.value
      expect(list[0]?.width_mm).toBe(200)
    }

    const deleted = deletePaperSpec(list, 'p1')
    expect(deleted.ok).toBe(true)
    if (deleted.ok) expect(deleted.value).toHaveLength(0)
  })

  it('rejects builtin paper deletes', () => {
    const list: PaperSpec[] = [{ ...userPaper('A4'), builtin: true }]
    const out = deletePaperSpec(list, 'A4')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe('builtin-protected')
  })
})

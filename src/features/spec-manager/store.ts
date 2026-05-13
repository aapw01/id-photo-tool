'use client'

/**
 * Zustand store that exposes the *user-defined* spec collections to
 * UI components and glues them to localStorage persistence.
 *
 * Layering:
 *
 *   - Pure data ops live in `crud.ts` / `merge.ts` so they're trivial
 *     to unit test.
 *   - This file wires those into a store that persists every
 *     successful mutation, plus selectors that return the merged
 *     (builtin + user) views.
 *   - The store auto-rehydrates from `loadSpecs()` on first read in
 *     the browser; in SSR / tests it starts empty until `rehydrate()`
 *     is called explicitly.
 */

import { useMemo } from 'react'
import { create } from 'zustand'

import { BUILTIN_LAYOUT_TEMPLATES } from '@/data/layout-templates'
import { BUILTIN_PAPER_SPECS } from '@/data/paper-specs'
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { LayoutTemplate, PaperSpec, PhotoSpec } from '@/types/spec'

import {
  createLayoutTemplate,
  createPaperSpec,
  createPhotoSpec,
  deleteLayoutTemplate,
  deletePaperSpec,
  deletePhotoSpec,
  updateLayoutTemplate,
  updatePaperSpec,
  updatePhotoSpec,
  type CrudResult,
} from './crud'
import { mergeLayoutTemplates, mergePaperSpecs, mergePhotoSpecs } from './merge'
import { clearSpecs, loadSpecs, saveSpecs } from './storage'
import { type SpecsV1 } from './schema'

interface SpecManagerState {
  hydrated: boolean
  customPhotoSpecs: PhotoSpec[]
  customPaperSpecs: PaperSpec[]
  customLayoutTemplates: LayoutTemplate[]

  rehydrate: () => void
  replaceAll: (next: SpecsV1) => void

  createPhoto: (candidate: unknown) => CrudResult<PhotoSpec[]>
  updatePhoto: (id: string, candidate: unknown) => CrudResult<PhotoSpec[]>
  deletePhoto: (id: string) => CrudResult<PhotoSpec[]>

  createPaper: (candidate: unknown) => CrudResult<PaperSpec[]>
  updatePaper: (id: string, candidate: unknown) => CrudResult<PaperSpec[]>
  deletePaper: (id: string) => CrudResult<PaperSpec[]>

  createLayout: (candidate: unknown) => CrudResult<LayoutTemplate[]>
  updateLayout: (id: string, candidate: unknown) => CrudResult<LayoutTemplate[]>
  deleteLayout: (id: string) => CrudResult<LayoutTemplate[]>
}

function persistSnapshot(state: SpecManagerState): void {
  saveSpecs({
    version: 1,
    photoSpecs: state.customPhotoSpecs,
    paperSpecs: state.customPaperSpecs,
    layoutTemplates: state.customLayoutTemplates,
  })
}

export const useSpecManagerStore = create<SpecManagerState>((set, get) => ({
  hydrated: false,
  customPhotoSpecs: [],
  customPaperSpecs: [],
  customLayoutTemplates: [],

  rehydrate() {
    const data = loadSpecs()
    set({
      hydrated: true,
      customPhotoSpecs: data.photoSpecs,
      customPaperSpecs: data.paperSpecs,
      customLayoutTemplates: data.layoutTemplates,
    })
  },

  replaceAll(next) {
    set({
      hydrated: true,
      customPhotoSpecs: next.photoSpecs,
      customPaperSpecs: next.paperSpecs,
      customLayoutTemplates: next.layoutTemplates,
    })
    persistSnapshot(get())
  },

  createPhoto(candidate) {
    const result = createPhotoSpec(get().customPhotoSpecs, candidate)
    if (result.ok) {
      set({ customPhotoSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },
  updatePhoto(id, candidate) {
    const result = updatePhotoSpec(get().customPhotoSpecs, id, candidate)
    if (result.ok) {
      set({ customPhotoSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },
  deletePhoto(id) {
    const result = deletePhotoSpec(get().customPhotoSpecs, id)
    if (result.ok) {
      set({ customPhotoSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },

  createPaper(candidate) {
    const result = createPaperSpec(get().customPaperSpecs, candidate)
    if (result.ok) {
      set({ customPaperSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },
  updatePaper(id, candidate) {
    const result = updatePaperSpec(get().customPaperSpecs, id, candidate)
    if (result.ok) {
      set({ customPaperSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },
  deletePaper(id) {
    const result = deletePaperSpec(get().customPaperSpecs, id)
    if (result.ok) {
      set({ customPaperSpecs: result.value })
      persistSnapshot(get())
    }
    return result
  },

  createLayout(candidate) {
    const result = createLayoutTemplate(get().customLayoutTemplates, candidate)
    if (result.ok) {
      set({ customLayoutTemplates: result.value })
      persistSnapshot(get())
    }
    return result
  },
  updateLayout(id, candidate) {
    const result = updateLayoutTemplate(get().customLayoutTemplates, id, candidate)
    if (result.ok) {
      set({ customLayoutTemplates: result.value })
      persistSnapshot(get())
    }
    return result
  },
  deleteLayout(id) {
    const result = deleteLayoutTemplate(get().customLayoutTemplates, id)
    if (result.ok) {
      set({ customLayoutTemplates: result.value })
      persistSnapshot(get())
    }
    return result
  },
}))

/* ------------------------------------------------------------------ */
/* Selectors                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hook returning the merged (builtin overridden by user) photo specs.
 *
 * The merge helpers always allocate a fresh array, so we memoise the
 * result on the `custom` reference. Without `useMemo` every consumer
 * receives a new array identity per render, which turned any effect
 * with this list in its dep array into a render→effect→setState loop
 * — that's exactly what hung the layout tab on first paint.
 */
export function useEffectivePhotoSpecs(): PhotoSpec[] {
  const custom = useSpecManagerStore((s) => s.customPhotoSpecs)
  return useMemo(() => mergePhotoSpecs(BUILTIN_PHOTO_SPECS, custom), [custom])
}

export function useEffectivePaperSpecs(): PaperSpec[] {
  const custom = useSpecManagerStore((s) => s.customPaperSpecs)
  return useMemo(() => mergePaperSpecs(BUILTIN_PAPER_SPECS, custom), [custom])
}

export function useEffectiveLayoutTemplates(): LayoutTemplate[] {
  const custom = useSpecManagerStore((s) => s.customLayoutTemplates)
  return useMemo(() => mergeLayoutTemplates(BUILTIN_LAYOUT_TEMPLATES, custom), [custom])
}

/** Re-export builtins so the page can list them without importing both. */
export { BUILTIN_LAYOUT_TEMPLATES, BUILTIN_PAPER_SPECS, BUILTIN_PHOTO_SPECS }

/** Test-only: clears the in-memory store and localStorage blob. */
export function __resetSpecManagerStoreForTesting(): void {
  clearSpecs()
  useSpecManagerStore.setState({
    hydrated: false,
    customPhotoSpecs: [],
    customPaperSpecs: [],
    customLayoutTemplates: [],
  })
}

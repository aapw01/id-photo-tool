'use client'

/**
 * Studio layout-tab state.
 *
 * Holds the currently chosen paper, template, and user overrides for
 * the visual settings. Persists nothing — layout choices reset when
 * the user replaces their photo (handled by `studio/store.ts`).
 */

import { create } from 'zustand'

import { BUILTIN_LAYOUT_TEMPLATES } from '@/data/layout-templates'
import { BUILTIN_PAPER_SPECS } from '@/data/paper-specs'
import type { LayoutTemplate, PaperSpec } from '@/types/spec'

export interface LayoutSettings {
  margin_mm: number
  gap_mm: number
  showSeparator: boolean
  showCutGuides: boolean
  backgroundColor: string
}

export interface LayoutState {
  paper: PaperSpec
  template: LayoutTemplate
  /** User-side overrides for `template.settings`. */
  settings: LayoutSettings

  setPaper: (paper: PaperSpec) => void
  setTemplate: (template: LayoutTemplate) => void
  setSettings: (partial: Partial<LayoutSettings>) => void
  reset: () => void
}

function defaultSettings(template: LayoutTemplate): LayoutSettings {
  return {
    margin_mm: template.settings?.margin_mm ?? 5,
    gap_mm: template.settings?.gap_mm ?? 2,
    showSeparator: template.settings?.showSeparator ?? true,
    showCutGuides: template.settings?.showCutGuides ?? false,
    backgroundColor: template.settings?.backgroundColor ?? '#FFFFFF',
  }
}

// Default to "8 × 1-inch on 5R" — the most common print-shop order.
const DEFAULT_TEMPLATE = BUILTIN_LAYOUT_TEMPLATES[0]!
const DEFAULT_PAPER =
  BUILTIN_PAPER_SPECS.find((p) => p.id === DEFAULT_TEMPLATE.paperId) ?? BUILTIN_PAPER_SPECS[0]!

export const useLayoutStore = create<LayoutState>((set) => ({
  paper: DEFAULT_PAPER,
  template: DEFAULT_TEMPLATE,
  settings: defaultSettings(DEFAULT_TEMPLATE),

  setPaper(paper) {
    set({ paper })
  },
  setTemplate(template) {
    // When the user picks a new template, reset the visual overrides
    // to whatever the template prescribes.
    set({ template, settings: defaultSettings(template) })
  },
  setSettings(partial) {
    set((state) => ({ settings: { ...state.settings, ...partial } }))
  },
  reset() {
    set({
      paper: DEFAULT_PAPER,
      template: DEFAULT_TEMPLATE,
      settings: defaultSettings(DEFAULT_TEMPLATE),
    })
  },
}))

'use client'

/**
 * Which right-rail panel is visible in the Studio.
 *
 * Kept in a separate, single-purpose zustand store so consumers don't
 * pull in the heavier `studio/store.ts` (which holds the active
 * bitmap and mask).
 */

import { create } from 'zustand'

export type StudioTab = 'background' | 'size' | 'layout' | 'export'

interface StudioTabState {
  tab: StudioTab
  setTab: (t: StudioTab) => void
}

export const useStudioTabStore = create<StudioTabState>((set) => ({
  tab: 'background',
  setTab: (tab) => set({ tab }),
}))

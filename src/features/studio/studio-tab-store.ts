'use client'

/**
 * Which right-rail panel is visible in the Studio.
 *
 * Kept in a separate, single-purpose zustand store so consumers don't
 * pull in the heavier `studio/store.ts` (which holds the active
 * bitmap and mask).
 *
 * `visited` records every tab the user has opened in this session.
 * `StudioTabs` renders a tiny "done" indicator on each visited tab so
 * the four pills feel like a connected `背景 → 尺寸 → 排版 → 导出`
 * workflow rather than four unrelated panels.
 */

import { create } from 'zustand'

export type StudioTab = 'background' | 'size' | 'layout' | 'export'

interface StudioTabState {
  tab: StudioTab
  visited: ReadonlySet<StudioTab>
  setTab: (t: StudioTab) => void
  resetVisited: () => void
}

const initialVisited = (initialTab: StudioTab): Set<StudioTab> => new Set<StudioTab>([initialTab])

export const useStudioTabStore = create<StudioTabState>((set) => ({
  tab: 'background',
  visited: initialVisited('background'),
  setTab: (tab) =>
    set((state) => {
      if (state.visited.has(tab)) return { tab }
      const visited = new Set(state.visited)
      visited.add(tab)
      return { tab, visited }
    }),
  resetVisited: () =>
    set(() => ({
      tab: 'background',
      visited: initialVisited('background'),
    })),
}))

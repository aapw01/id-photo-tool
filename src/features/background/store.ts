'use client'

/**
 * Background-colour state for the Studio.
 *
 * Holds:
 *   - The current background choice (transparent | hex colour)
 *   - The "recently used" stack (max 8, LRU, deduped) persisted in
 *     localStorage so it survives reloads.
 *
 * The store is intentionally tiny — every selector is a single
 * property — so consumers don't accidentally subscribe to the whole
 * thing and re-render on unrelated changes.
 */

import { create } from 'zustand'

import { parseHex, type BgColor } from './composite'

export interface BackgroundState {
  current: BgColor
  recent: string[]
  setColor: (color: BgColor) => void
  reset: () => void
}

export const RECENT_MAX = 8
export const RECENT_KEY = 'pixfit.bg.recent'

const DEFAULT_COLOR: BgColor = { kind: 'transparent' }

/**
 * Pure LRU+dedupe helper. Exposed for tests.
 *
 * - Hex strings are normalised to lowercase before comparison.
 * - Adding an existing entry moves it to the front (no duplicate).
 * - List is capped at `max`.
 */
export function pushRecent(prev: readonly string[], hex: string, max = RECENT_MAX): string[] {
  const norm = hex.trim().toLowerCase()
  if (!parseHex(norm)) return [...prev]
  const filtered = prev.filter((c) => c.toLowerCase() !== norm)
  return [norm, ...filtered].slice(0, max)
}

function getStorage(): Storage | null {
  const g = globalThis as { localStorage?: Storage }
  return g.localStorage ?? null
}

function readRecent(): string[] {
  const store = getStorage()
  if (!store) return []
  try {
    const raw = store.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && parseHex(v) !== null)
  } catch {
    return []
  }
}

function writeRecent(values: readonly string[]): void {
  const store = getStorage()
  if (!store) return
  try {
    store.setItem(RECENT_KEY, JSON.stringify(values))
  } catch (err) {
    // Storage quota / private mode — best-effort, but log so we don't
    // silently lose recents during dev.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[pixfit] failed to persist recent colours', err)
    }
  }
}

export const useBackgroundStore = create<BackgroundState>((set, get) => ({
  current: DEFAULT_COLOR,
  recent: readRecent(),

  setColor(color) {
    set({ current: color })
    if (color.kind === 'color') {
      const next = pushRecent(get().recent, color.hex)
      set({ recent: next })
      writeRecent(next)
    }
  },

  reset() {
    set({ current: DEFAULT_COLOR })
  },
}))

/** Test-only: clear in-memory state without touching localStorage. */
export function __resetBackgroundStoreForTesting(): void {
  useBackgroundStore.setState({ current: DEFAULT_COLOR, recent: [] })
}

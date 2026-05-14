import { describe, expect, it } from 'vitest'

import {
  capEntries,
  HISTORY_MAX_ENTRIES,
  HISTORY_TTL_MS,
  pruneExpired,
  type ScannerHistoryEntry,
} from './history-store'

function makeEntry(overrides: Partial<ScannerHistoryEntry> = {}): ScannerHistoryEntry {
  return {
    id: 'fixture-id',
    createdAt: 1_700_000_000_000,
    docSpecId: 'cn-id-card',
    paperSize: 'a4',
    outputMode: 'scan',
    watermark: { text: 'For demo only', opacity: 0.5, density: 'normal' },
    ...overrides,
  }
}

describe('pruneExpired', () => {
  it('keeps entries within the TTL window', () => {
    const now = 1_700_000_000_000
    const keep = makeEntry({ id: 'recent', createdAt: now - HISTORY_TTL_MS / 2 })
    expect(pruneExpired([keep], now)).toEqual([keep])
  })

  it('drops entries past the TTL window', () => {
    const now = 1_700_000_000_000
    const stale = makeEntry({ id: 'stale', createdAt: now - HISTORY_TTL_MS - 1 })
    expect(pruneExpired([stale], now)).toEqual([])
  })

  it('treats `now - createdAt === ttl` as expired (strict <)', () => {
    const now = 1_700_000_000_000
    const boundary = makeEntry({ id: 'boundary', createdAt: now - HISTORY_TTL_MS })
    expect(pruneExpired([boundary], now)).toEqual([])
  })

  it('honours a custom ttl argument', () => {
    const now = 1_700_000_000_000
    const entry = makeEntry({ createdAt: now - 200 })
    expect(pruneExpired([entry], now, 100)).toEqual([])
    expect(pruneExpired([entry], now, 500)).toEqual([entry])
  })

  it('preserves order of survivors', () => {
    const now = 1_700_000_000_000
    const a = makeEntry({ id: 'a', createdAt: now - 100 })
    const b = makeEntry({ id: 'b', createdAt: now - 200 })
    expect(pruneExpired([a, b], now)).toEqual([a, b])
  })
})

describe('capEntries', () => {
  it('caps a long list to HISTORY_MAX_ENTRIES by default', () => {
    const long = Array.from({ length: 25 }, (_, idx) =>
      makeEntry({ id: `e${idx}`, createdAt: 1_700_000_000_000 - idx }),
    )
    expect(capEntries(long)).toHaveLength(HISTORY_MAX_ENTRIES)
  })

  it('returns the head of the list — newest first', () => {
    const newest = makeEntry({ id: 'newest', createdAt: 10 })
    const middle = makeEntry({ id: 'middle', createdAt: 5 })
    const oldest = makeEntry({ id: 'oldest', createdAt: 1 })
    expect(capEntries([newest, middle, oldest], 2)).toEqual([newest, middle])
  })

  it('returns the input unchanged when shorter than the cap', () => {
    const e = makeEntry()
    expect(capEntries([e], 10)).toEqual([e])
  })

  it('respects a custom max', () => {
    const long = Array.from({ length: 5 }, (_, idx) => makeEntry({ id: `e${idx}`, createdAt: idx }))
    expect(capEntries(long, 3)).toHaveLength(3)
  })

  it('returns an empty list for cap=0', () => {
    expect(capEntries([makeEntry()], 0)).toEqual([])
  })
})

describe('HISTORY_MAX_ENTRIES + HISTORY_TTL_MS', () => {
  it('caps at the PRD-mandated 10 entries', () => {
    expect(HISTORY_MAX_ENTRIES).toBe(10)
  })

  it('keeps the TTL at 30 days', () => {
    expect(HISTORY_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

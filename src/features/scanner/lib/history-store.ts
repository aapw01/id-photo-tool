'use client'

/**
 * Scanner session history.
 *
 * Persists the *configuration* of recently completed scans (DocSpec,
 * paper size, output mode, watermark) so the user can restore those
 * settings later. We deliberately **do not** persist the document
 * images themselves — privacy parity with the rest of Pixfit (no
 * server uploads, no long-term local image storage) and a hard rule
 * baked into the PRD: a scanned ID-document sitting in IndexedDB is
 * a latent privacy/abuse vector we refuse to introduce.
 *
 * Storage:
 *   - IndexedDB via `idb-keyval`. Single key holds the whole array.
 *   - Cap: 10 entries (LRU on insert).
 *   - TTL: 30 days (entries past their freshness window are pruned
 *     transparently on every read).
 *
 * SSR safety: every function is guarded against missing `indexedDB`
 * (Node, prerender). The accessors return empty / no-op behaviour
 * there so server components can call them at the boundary without
 * throwing.
 */

import { get as idbGet, set as idbSet, del as idbDel, clear as idbClear } from 'idb-keyval'

import type { OutputMode } from './render-modes'
import type { PaperSize } from './pack-a4'
import type { WatermarkConfig } from './watermark'

export const HISTORY_STORAGE_KEY = 'pixfit:scanner:history:v1'
export const HISTORY_MAX_ENTRIES = 10
export const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface ScannerHistoryEntry {
  /** Random id used for list keys + removal. */
  id: string
  /** UNIX epoch ms — when the entry was first written. */
  createdAt: number
  /** DocSpec id (e.g. `cn-id-card`). Mirrors `store.docSpecId`. */
  docSpecId: string
  /** Paper size used for export (a4 / letter / a5). */
  paperSize: PaperSize
  /** Output mode (scan / copy / enhance). */
  outputMode: OutputMode
  /** Watermark snapshot — same shape as `store.watermark`. */
  watermark: WatermarkConfig
}

function hasIDB(): boolean {
  if (typeof globalThis === 'undefined') return false
  // happy-dom 20 + Node 22 still don't ship a real IndexedDB; bail
  // out early so the consumer code doesn't see a noisy promise
  // rejection from idb-keyval.
  return typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined'
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isHistoryEntry(value: unknown): value is ScannerHistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ScannerHistoryEntry>
  if (typeof v.id !== 'string' || !v.id) return false
  if (typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt)) return false
  if (typeof v.docSpecId !== 'string' || !v.docSpecId) return false
  if (v.paperSize !== 'a4' && v.paperSize !== 'letter' && v.paperSize !== 'a5') return false
  if (v.outputMode !== 'scan' && v.outputMode !== 'copy' && v.outputMode !== 'enhance') return false
  if (typeof v.watermark !== 'object' || v.watermark === null) return false
  const w = v.watermark
  if (
    typeof w.text !== 'string' ||
    typeof w.opacity !== 'number' ||
    (w.density !== 'sparse' && w.density !== 'normal' && w.density !== 'dense')
  ) {
    return false
  }
  return true
}

/**
 * Drop entries whose `createdAt` is older than `HISTORY_TTL_MS`.
 * Pure function so the consumer / test can verify without mocking
 * Date.now().
 */
export function pruneExpired(
  entries: readonly ScannerHistoryEntry[],
  now: number = Date.now(),
  ttlMs: number = HISTORY_TTL_MS,
): ScannerHistoryEntry[] {
  return entries.filter((e) => now - e.createdAt < ttlMs)
}

/**
 * Cap a sorted-descending list to the `max` most recent entries.
 * Pure for the same reason as `pruneExpired`.
 */
export function capEntries(
  entries: readonly ScannerHistoryEntry[],
  max: number = HISTORY_MAX_ENTRIES,
): ScannerHistoryEntry[] {
  return entries.slice(0, max)
}

/**
 * Read and normalise the history from IndexedDB. Always returns a
 * sorted-descending (newest first) list. Filters out expired and
 * malformed entries, then caps to `HISTORY_MAX_ENTRIES`.
 *
 * Returns `[]` if IndexedDB is unavailable.
 */
export async function listHistory(): Promise<ScannerHistoryEntry[]> {
  if (!hasIDB()) return []
  try {
    const raw = await idbGet<unknown>(HISTORY_STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    const valid = raw.filter(isHistoryEntry)
    const sorted = [...valid].sort((a, b) => b.createdAt - a.createdAt)
    return capEntries(pruneExpired(sorted))
  } catch {
    return []
  }
}

interface AddEntryInput {
  docSpecId: string
  paperSize: PaperSize
  outputMode: OutputMode
  watermark: WatermarkConfig
}

/**
 * Prepend a new entry to the history, dropping any entry with the
 * same `docSpecId + paperSize + outputMode + watermark text` triple
 * so the list isn't flooded by repeated exports of the same config.
 * Returns the updated list (sorted-desc, capped).
 *
 * No-op when IndexedDB is unavailable.
 */
export async function addEntry(input: AddEntryInput): Promise<ScannerHistoryEntry[]> {
  if (!hasIDB()) return []
  const current = await listHistory()
  const sameKey = (e: ScannerHistoryEntry) =>
    e.docSpecId === input.docSpecId &&
    e.paperSize === input.paperSize &&
    e.outputMode === input.outputMode &&
    e.watermark.text === input.watermark.text &&
    e.watermark.density === input.watermark.density
  const deduped = current.filter((e) => !sameKey(e))
  const next: ScannerHistoryEntry = {
    id: generateId(),
    createdAt: Date.now(),
    docSpecId: input.docSpecId,
    paperSize: input.paperSize,
    outputMode: input.outputMode,
    watermark: { ...input.watermark },
  }
  const updated = capEntries([next, ...deduped])
  try {
    await idbSet(HISTORY_STORAGE_KEY, updated)
  } catch {
    // Persisting failed (storage quota, private mode, etc.) — degrade
    // silently. The in-memory return value is still useful to the
    // caller in the same session.
  }
  return updated
}

/** Remove a single entry by id. Returns the updated list. */
export async function removeEntry(id: string): Promise<ScannerHistoryEntry[]> {
  if (!hasIDB()) return []
  const current = await listHistory()
  const next = current.filter((e) => e.id !== id)
  try {
    if (next.length === 0) {
      await idbDel(HISTORY_STORAGE_KEY)
    } else {
      await idbSet(HISTORY_STORAGE_KEY, next)
    }
  } catch {
    // See `addEntry` for the rationale.
  }
  return next
}

/** Drop the entire history. */
export async function clearHistory(): Promise<void> {
  if (!hasIDB()) return
  try {
    await idbClear()
  } catch {
    // ignore
  }
}

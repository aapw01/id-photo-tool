/**
 * JSON export / import for user-defined specs.
 *
 * The export blob is the same `SpecsV1` shape we persist to
 * localStorage so an export → fresh-browser → import cycle is
 * lossless. The exported file name follows
 * `pixfit-specs-{YYYYMMDD}.json` to match the rest of the export
 * naming convention (see PRD §5.8.4 / §9.4.3).
 *
 * Import is strict: malformed JSON, missing version, wrong shape, all
 * roll up into a single `ImportError` with a code + message + zod
 * issues so the UI can show field-level breakdowns.
 */

import { z } from 'zod'

import { SpecsV1Schema, makeEmptySpecsV1, type SpecsV1 } from './schema'

export const EXPORT_MIME = 'application/json'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatExportDate(date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

export function exportFilename(date = new Date()): string {
  return `pixfit-specs-${formatExportDate(date)}.json`
}

/** Serialise the specs payload as a pretty-printed JSON string. */
export function specsToJsonString(specs: SpecsV1): string {
  return JSON.stringify(specs, null, 2)
}

/** Build a `Blob` suitable for download. Browser-only path. */
export function exportToJSON(specs: SpecsV1): Blob {
  return new Blob([specsToJsonString(specs)], { type: EXPORT_MIME })
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type ImportErrorCode =
  | 'empty-input'
  | 'invalid-json'
  | 'invalid-schema'
  | 'unsupported-version'

export interface ImportError {
  ok: false
  code: ImportErrorCode
  message: string
  issues?: z.ZodIssue[]
}

export interface ImportOk {
  ok: true
  value: SpecsV1
}

export type ImportResult = ImportOk | ImportError

const fail = (code: ImportErrorCode, message: string, issues?: z.ZodIssue[]): ImportError => ({
  ok: false,
  code,
  message,
  issues,
})

/**
 * Parse + validate a raw JSON string. Surfaces version errors
 * separately because users sometimes paste an older export and
 * deserve a clearer message than "validation failed".
 */
export function parseSpecsJson(raw: string): ImportResult {
  const trimmed = raw.trim()
  if (!trimmed) return fail('empty-input', 'Import payload is empty')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    return fail('invalid-json', err instanceof Error ? err.message : String(err))
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    'version' in parsed &&
    typeof (parsed as { version: unknown }).version === 'number' &&
    (parsed as { version: number }).version !== 1
  ) {
    return fail(
      'unsupported-version',
      `Unsupported specs schema version: ${(parsed as { version: number }).version}`,
    )
  }

  const result = SpecsV1Schema.safeParse(parsed)
  if (!result.success) {
    return fail('invalid-schema', 'Spec payload failed schema validation', result.error.issues)
  }
  return { ok: true, value: result.data }
}

/**
 * Browser File → SpecsV1 (or ImportError). Reads the file as text and
 * delegates to `parseSpecsJson`.
 */
export async function importFromJSON(file: File): Promise<ImportResult> {
  let text: string
  try {
    text = await file.text()
  } catch (err) {
    return fail('invalid-json', err instanceof Error ? err.message : String(err))
  }
  return parseSpecsJson(text)
}

/** Re-export for callers that want a blank payload to start from. */
export { makeEmptySpecsV1 }

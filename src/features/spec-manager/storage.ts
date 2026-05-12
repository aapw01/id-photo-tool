/**
 * localStorage adapter for user-defined specs.
 *
 * - Reads happen lazily on store boot and after every successful write.
 * - All parse / validation errors are swallowed (with a `console.warn`
 *   so we don't lose them in dev) and treated as "no user specs yet";
 *   we never blow up the studio because somebody hand-edited the JSON.
 * - Writes always re-validate via `SpecsV1Schema` so we don't persist
 *   a malformed object created by a careless caller.
 *
 * Test environments under `happy-dom` rely on the in-memory shim in
 * `vitest.setup.ts` so `globalThis.localStorage` is always defined.
 */

import {
  SPECS_STORAGE_KEY,
  SpecsV1Schema,
  makeEmptySpecsV1,
  type SpecsV1,
} from './schema'

function getStorage(): Storage | null {
  const g = globalThis as { localStorage?: Storage }
  return g.localStorage ?? null
}

/**
 * Read the persisted specs. Falls back to an empty v1 record when the
 * key is absent, the JSON is corrupt, the version is unknown, or the
 * schema rejects the payload.
 */
export function loadSpecs(): SpecsV1 {
  const store = getStorage()
  if (!store) return makeEmptySpecsV1()

  let raw: string | null
  try {
    raw = store.getItem(SPECS_STORAGE_KEY)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[pixfit/spec-manager] failed to read localStorage', err)
    }
    return makeEmptySpecsV1()
  }
  if (!raw) return makeEmptySpecsV1()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[pixfit/spec-manager] corrupt JSON in localStorage', err)
    }
    return makeEmptySpecsV1()
  }

  const result = SpecsV1Schema.safeParse(parsed)
  if (!result.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[pixfit/spec-manager] localStorage payload failed validation, falling back to empty',
        result.error.issues,
      )
    }
    return makeEmptySpecsV1()
  }

  return result.data
}

/**
 * Persist a `SpecsV1` payload. Returns `true` on success.
 *
 * The payload is re-validated before writing — that way every call
 * site (CRUD actions, import) ends up funnelling through one schema
 * check instead of relying on convention.
 */
export function saveSpecs(specs: SpecsV1): boolean {
  const store = getStorage()
  if (!store) return false

  const validated = SpecsV1Schema.safeParse(specs)
  if (!validated.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[pixfit/spec-manager] refusing to persist invalid specs',
        validated.error.issues,
      )
    }
    return false
  }

  try {
    store.setItem(SPECS_STORAGE_KEY, JSON.stringify(validated.data))
    return true
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[pixfit/spec-manager] failed to write localStorage', err)
    }
    return false
  }
}

/** Drop the persisted blob entirely. Used by "reset" + tests. */
export function clearSpecs(): void {
  const store = getStorage()
  if (!store) return
  try {
    store.removeItem(SPECS_STORAGE_KEY)
  } catch {
    // best-effort
  }
}

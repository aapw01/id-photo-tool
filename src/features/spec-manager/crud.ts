/**
 * Pure CRUD operations on the in-memory user-spec collections.
 *
 * Every action is a `(prev[], payload) -> next[] | CrudError` function
 * — no zustand, no localStorage. The store layer (`store.ts`) glues
 * them to the persistence layer.
 *
 * Two non-obvious rules enforced here:
 *
 *   - `builtin: true` is the sole protection against accidental
 *     deletion. Callers can pass in an arbitrary list (e.g. a merged
 *     builtin + user list) and we still refuse to delete entries that
 *     advertise themselves as built-in.
 *   - Updates always re-write the id from the existing entry; the
 *     caller's `id` field is ignored. This avoids the foot-gun where
 *     editing a custom spec accidentally renames it and dangles its
 *     existing dependents.
 *
 * Zod validation runs before insert / update. Validation failures
 * surface as a `CrudError` with the issues attached so the UI can
 * highlight specific fields without having to throw across the
 * boundary.
 */

import { z } from 'zod'

import {
  LayoutTemplateSchema,
  PaperSpecSchema,
  PhotoSpecSchema,
  type LayoutTemplate,
  type PaperSpec,
  type PhotoSpec,
} from '@/types/spec'

export type CrudErrorCode = 'validation-failed' | 'id-conflict' | 'not-found' | 'builtin-protected'

export interface CrudError {
  ok: false
  code: CrudErrorCode
  message: string
  issues?: z.ZodIssue[]
}

export interface CrudOk<T> {
  ok: true
  value: T
}

export type CrudResult<T> = CrudOk<T> | CrudError

const fail = (code: CrudErrorCode, message: string, issues?: z.ZodIssue[]): CrudError => ({
  ok: false,
  code,
  message,
  issues,
})

const ok = <T>(value: T): CrudOk<T> => ({ ok: true, value })

interface WithId {
  id: string
}
interface WithBuiltinFlag {
  builtin: boolean
}

/* ------------------------------------------------------------------ */
/* Internals                                                            */
/* ------------------------------------------------------------------ */

function validateOrFail<S extends z.ZodType>(
  schema: S,
  candidate: unknown,
): CrudResult<z.infer<S>> {
  const parsed = schema.safeParse(candidate)
  if (!parsed.success) {
    return fail('validation-failed', 'Spec failed schema validation', parsed.error.issues)
  }
  return ok(parsed.data)
}

function createGeneric<T extends WithId & WithBuiltinFlag, S extends z.ZodType>(
  schema: S,
  list: readonly T[],
  candidate: unknown,
): CrudResult<T[]> {
  const v = validateOrFail(schema, candidate)
  if (!v.ok) return v
  const next = v.value as T
  if (next.builtin) {
    return fail('validation-failed', 'User-created entries cannot be marked builtin')
  }
  if (list.some((entry) => entry.id === next.id)) {
    return fail('id-conflict', `Duplicate id: ${next.id}`)
  }
  return ok([...list, next])
}

function updateGeneric<T extends WithId & WithBuiltinFlag, S extends z.ZodType>(
  schema: S,
  list: readonly T[],
  id: string,
  candidate: unknown,
): CrudResult<T[]> {
  const idx = list.findIndex((entry) => entry.id === id)
  if (idx === -1) return fail('not-found', `No entry with id: ${id}`)
  const existing = list[idx]
  if (!existing) return fail('not-found', `No entry with id: ${id}`)
  if (existing.builtin) return fail('builtin-protected', `Cannot edit builtin entry: ${id}`)

  // Caller supplies the next spec payload. We force-pin the id and
  // builtin flag so the operation cannot accidentally rename or
  // promote a custom entry into a builtin.
  const pinned = {
    ...(candidate as Record<string, unknown>),
    id,
    builtin: false,
  }
  const v = validateOrFail(schema, pinned)
  if (!v.ok) return v

  const next = [...list]
  next[idx] = v.value as T
  return ok(next)
}

function deleteGeneric<T extends WithId & WithBuiltinFlag>(
  list: readonly T[],
  id: string,
): CrudResult<T[]> {
  const target = list.find((entry) => entry.id === id)
  if (!target) return fail('not-found', `No entry with id: ${id}`)
  if (target.builtin) {
    return fail('builtin-protected', `Cannot delete builtin entry: ${id}`)
  }
  return ok(list.filter((entry) => entry.id !== id))
}

/* ------------------------------------------------------------------ */
/* PhotoSpec                                                            */
/* ------------------------------------------------------------------ */

export const createPhotoSpec = (list: readonly PhotoSpec[], candidate: unknown) =>
  createGeneric<PhotoSpec, typeof PhotoSpecSchema>(PhotoSpecSchema, list, candidate)

export const updatePhotoSpec = (list: readonly PhotoSpec[], id: string, candidate: unknown) =>
  updateGeneric<PhotoSpec, typeof PhotoSpecSchema>(PhotoSpecSchema, list, id, candidate)

export const deletePhotoSpec = (list: readonly PhotoSpec[], id: string) =>
  deleteGeneric<PhotoSpec>(list, id)

/* ------------------------------------------------------------------ */
/* PaperSpec                                                            */
/* ------------------------------------------------------------------ */

export const createPaperSpec = (list: readonly PaperSpec[], candidate: unknown) =>
  createGeneric<PaperSpec, typeof PaperSpecSchema>(PaperSpecSchema, list, candidate)

export const updatePaperSpec = (list: readonly PaperSpec[], id: string, candidate: unknown) =>
  updateGeneric<PaperSpec, typeof PaperSpecSchema>(PaperSpecSchema, list, id, candidate)

export const deletePaperSpec = (list: readonly PaperSpec[], id: string) =>
  deleteGeneric<PaperSpec>(list, id)

/* ------------------------------------------------------------------ */
/* LayoutTemplate                                                       */
/* ------------------------------------------------------------------ */

export const createLayoutTemplate = (list: readonly LayoutTemplate[], candidate: unknown) =>
  createGeneric<LayoutTemplate, typeof LayoutTemplateSchema>(LayoutTemplateSchema, list, candidate)

export const updateLayoutTemplate = (
  list: readonly LayoutTemplate[],
  id: string,
  candidate: unknown,
) =>
  updateGeneric<LayoutTemplate, typeof LayoutTemplateSchema>(
    LayoutTemplateSchema,
    list,
    id,
    candidate,
  )

export const deleteLayoutTemplate = (list: readonly LayoutTemplate[], id: string) =>
  deleteGeneric<LayoutTemplate>(list, id)

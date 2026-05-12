/**
 * Merge builtin specs with user-defined overrides.
 *
 * Rules (PRD §9.4.2):
 *
 *   - The merged list is `[...builtins, ...userOverrides]` where user
 *     entries with the same id as a builtin REPLACE the builtin entry
 *     in place (the override keeps the builtin's slot in iteration
 *     order so the UI doesn't reshuffle when a user customises).
 *   - User entries with a brand-new id are appended after the
 *     builtins.
 *   - The `builtin` flag on the resulting entry is always taken from
 *     the source object — overrides authored by the user carry
 *     `builtin: false`, which is how `crud.deletePhotoSpec` and the
 *     UI tell them apart from real builtins.
 *
 * The functions are intentionally pure (no `this`, no I/O) so unit
 * tests stay trivial.
 */

import type { LayoutTemplate, PaperSpec, PhotoSpec } from './schema'

interface WithId {
  id: string
}

export function mergeById<T extends WithId>(builtins: readonly T[], user: readonly T[]): T[] {
  const userIndex = new Map(user.map((entry) => [entry.id, entry]))
  const seen = new Set<string>()
  const out: T[] = []

  for (const b of builtins) {
    const override = userIndex.get(b.id)
    if (override) {
      out.push(override)
      seen.add(b.id)
    } else {
      out.push(b)
    }
  }
  for (const u of user) {
    if (!seen.has(u.id)) {
      out.push(u)
    }
  }
  return out
}

export const mergePhotoSpecs = (b: readonly PhotoSpec[], u: readonly PhotoSpec[]): PhotoSpec[] =>
  mergeById(b, u)

export const mergePaperSpecs = (b: readonly PaperSpec[], u: readonly PaperSpec[]): PaperSpec[] =>
  mergeById(b, u)

export const mergeLayoutTemplates = (
  b: readonly LayoutTemplate[],
  u: readonly LayoutTemplate[],
): LayoutTemplate[] => mergeById(b, u)

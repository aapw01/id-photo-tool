/**
 * Reverse-lookup helpers used by the delete-confirmation flow (PRD
 * §5.7.4).
 *
 * `findDependents` returns the layout templates that reference a given
 * PhotoSpec / PaperSpec, so the UI can surface "deleting this spec
 * will affect N templates" before the user confirms.
 *
 * The functions accept an explicit `templates` list rather than
 * reading from the store — pure inputs keep them easy to test and let
 * the UI pass the *merged* (builtin + user) view in, which is the
 * only one that matters for dependency reasoning.
 */

import type { LayoutTemplate } from '@/types/spec'

export function findDependentsByPhotoSpec(
  photoSpecId: string,
  templates: readonly LayoutTemplate[],
): LayoutTemplate[] {
  return templates.filter((tpl) => {
    if (tpl.items.some((item) => item.photoSpecId === photoSpecId)) return true
    if (
      tpl.arrangement.kind === 'manual' &&
      tpl.arrangement.cells.some((c) => c.photoSpecId === photoSpecId)
    ) {
      return true
    }
    return false
  })
}

export function findDependentsByPaperSpec(
  paperSpecId: string,
  templates: readonly LayoutTemplate[],
): LayoutTemplate[] {
  return templates.filter((tpl) => tpl.paperId === paperSpecId)
}

/**
 * Generic dispatch used by the UI delete dialog. Returns dependents
 * of either kind.
 */
export function findDependents(
  spec: { kind: 'photo' | 'paper'; id: string },
  templates: readonly LayoutTemplate[],
): LayoutTemplate[] {
  return spec.kind === 'photo'
    ? findDependentsByPhotoSpec(spec.id, templates)
    : findDependentsByPaperSpec(spec.id, templates)
}

/**
 * Spec resolver used by every layout consumer (preview, actions,
 * mixed editor) so non-builtin PhotoSpecs — typically the user's
 * inline-custom size from the size tab or a user-saved spec from
 * `/specs` — still resolve when their id appears in a layout
 * template's items.
 *
 * `makeSpecResolver(list, active)` returns a `(id) => PhotoSpec | null`
 * closure that looks up by id across a merged builtin + custom list
 * (typically `useEffectivePhotoSpecs()`'s output), falling back to
 * the still-ephemeral `active` inline spec when one is supplied —
 * the inline-custom spec from the size tab isn't persisted, so it's
 * not in the effective list yet.
 */

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { PhotoSpec } from '@/types/spec'

export type SpecResolver = (id: string) => PhotoSpec | null

export function makeSpecResolver(
  list: readonly PhotoSpec[],
  active: PhotoSpec | null = null,
): SpecResolver {
  return (id) => {
    const fromList = list.find((s) => s.id === id)
    if (fromList) return fromList
    if (active && active.id === id) return active
    return null
  }
}

/**
 * Convenience overload used by the few non-React callers that don't
 * have access to `useEffectivePhotoSpecs()` — falls back to the
 * built-in catalogue + the optional active spec.
 */
export function makeBuiltinSpecResolver(active: PhotoSpec | null = null): SpecResolver {
  return makeSpecResolver(BUILTIN_PHOTO_SPECS, active)
}

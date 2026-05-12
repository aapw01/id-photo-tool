/**
 * Spec resolver used by every layout consumer (preview, actions,
 * mixed editor) so non-builtin PhotoSpecs — typically the user's
 * inline-custom size from the size tab — still resolve when their id
 * appears in a layout template's items.
 *
 * `makeSpecResolver(active)` returns a `(id) => PhotoSpec | null`
 * closure that checks the built-in registry first and falls back to
 * the active custom spec when its id matches. Future work will plug
 * in a multi-entry custom-spec map; we keep the shape ready by
 * accepting an optional `CustomSpecMap`.
 */

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { PhotoSpec } from '@/types/spec'

export type CustomSpecMap = Map<string, PhotoSpec>

export type SpecResolver = (id: string) => PhotoSpec | null

export function makeSpecResolver(active: PhotoSpec | null, custom?: CustomSpecMap): SpecResolver {
  return (id) => {
    const builtin = BUILTIN_PHOTO_SPECS.find((s) => s.id === id)
    if (builtin) return builtin
    const fromMap = custom?.get(id)
    if (fromMap) return fromMap
    if (active && active.id === id) return active
    return null
  }
}

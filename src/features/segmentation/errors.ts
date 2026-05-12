/**
 * Surface segmentation Worker errors to the UI.
 *
 * The worker classifies failures into a small, stable `ErrorKind` set
 * (see worker-protocol.ts). The UI maps that kind to a translation key
 * via `messageKey()` and renders it through next-intl. We deliberately
 * keep this client-side and pure so it's testable without React.
 */

import type { ErrorKind } from './worker-protocol'

const KINDS = ['network', 'integrity', 'init', 'inference', 'unknown'] as const

/**
 * The full set of error kinds, in display order. Used by tests + the
 * dev page to walk every translation.
 */
export const ALL_ERROR_KINDS: readonly ErrorKind[] = KINDS

/**
 * Map an arbitrary worker payload to a known ErrorKind. Anything outside
 * the canonical list is collapsed to `unknown` so the UI always has a
 * fallback to show.
 */
export function normalizeErrorKind(kind: string | undefined | null): ErrorKind {
  if (!kind) return 'unknown'
  return KINDS.includes(kind as ErrorKind) ? (kind as ErrorKind) : 'unknown'
}

/**
 * Translation key under the Segmentation.errors namespace. The intent
 * is callers go: `t(messageKey(kind))` — the prefix is implicit.
 */
export function messageKey(kind: ErrorKind): `errors.${ErrorKind}` {
  return `errors.${kind}` as const
}

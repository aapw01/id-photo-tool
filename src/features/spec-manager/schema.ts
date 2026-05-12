/**
 * Spec-manager persistence schema (v1).
 *
 * The shape persisted to `localStorage['pixfit:specs:v1']`. Only the
 * `builtin: false` slice of each kind is stored — built-in entries are
 * always read fresh from `@/data/*-specs.ts` so we never accidentally
 * pin a stale snapshot.
 *
 * The schema is intentionally lenient on missing-array (-> defaults to
 * `[]`) but strict on shape — every entry must satisfy the canonical
 * `PhotoSpecSchema` / `PaperSpecSchema` / `LayoutTemplateSchema` from
 * `@/types/spec`.
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

export const SPECS_STORAGE_KEY = 'pixfit:specs:v1'
export const SPECS_SCHEMA_VERSION = 1

/** Tagged-version envelope so future migrations stay safe. */
export const SpecsV1Schema = z.object({
  version: z.literal(SPECS_SCHEMA_VERSION),
  photoSpecs: z.array(PhotoSpecSchema).default([]),
  paperSpecs: z.array(PaperSpecSchema).default([]),
  layoutTemplates: z.array(LayoutTemplateSchema).default([]),
})
export type SpecsV1 = z.infer<typeof SpecsV1Schema>

export function makeEmptySpecsV1(): SpecsV1 {
  return {
    version: SPECS_SCHEMA_VERSION,
    photoSpecs: [],
    paperSpecs: [],
    layoutTemplates: [],
  }
}

/** Convenience re-exports so the module is the single import surface. */
export type { LayoutTemplate, PaperSpec, PhotoSpec }

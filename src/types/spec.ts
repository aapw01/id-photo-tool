/**
 * Pixfit data model — single source of truth for the three layers
 * outlined in PRD §9:
 *
 *   - `PhotoSpec`     — finished photo (size + bg + file rules + composition)
 *   - `PaperSpec`     — print paper (size + DPI)
 *   - `LayoutTemplate`— paper × N photos × arrangement (M6 lands the
 *                       arrangement renderer; we declare the shape now
 *                       so saved templates remain backward-compatible).
 *
 * Each type pairs with a zod schema (same names + `Schema` suffix) so
 * user-imported JSON gets validated against the live shape at runtime.
 */

import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/* i18n payload                                                               */
/* -------------------------------------------------------------------------- */

export const I18nTextSchema = z.object({
  zh: z.string(),
  'zh-Hant': z.string(),
  en: z.string(),
})
export type I18nText = z.infer<typeof I18nTextSchema>

/* -------------------------------------------------------------------------- */
/* PhotoSpec                                                                  */
/* -------------------------------------------------------------------------- */

export const PHOTO_CATEGORIES = [
  'cn-id',
  'cn-paper',
  'visa',
  'travel-permit',
  'exam',
  'custom',
] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

const PixelRangeSchema = z.object({
  wMin: z.number().int().positive(),
  wMax: z.number().int().positive(),
  hMin: z.number().int().positive(),
  hMax: z.number().int().positive(),
})

const FileRulesSchema = z.object({
  maxKB: z.number().positive().optional(),
  minKB: z.number().positive().optional(),
  formats: z.array(z.enum(['jpg', 'png'])).optional(),
  pixelRange: PixelRangeSchema.optional(),
})

const CompositionSchema = z.object({
  /** Head height as a fraction of frame height, e.g. [0.50, 0.69] */
  headHeightRatio: z.tuple([z.number(), z.number()]).optional(),
  /** Distance from frame top to eye line, as a fraction, e.g. [0.30, 0.45] */
  eyeLineFromTop: z.tuple([z.number(), z.number()]).optional(),
})

const BackgroundSchema = z.object({
  /** Required background colour (hex). UI auto-applies this. */
  recommended: z.string(),
  /** Other accepted colours (e.g. light gray for UK visa). */
  allowed: z.array(z.string()).optional(),
})

export const PhotoSpecSchema = z.object({
  id: z.string().min(1),
  builtin: z.boolean(),
  category: z.enum(PHOTO_CATEGORIES),
  region: z.string().optional(),
  name: I18nTextSchema,
  description: I18nTextSchema.optional(),

  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  dpi: z.number().int().positive(),
  width_px: z.number().int().positive().optional(),
  height_px: z.number().int().positive().optional(),

  background: BackgroundSchema.optional(),
  fileRules: FileRulesSchema.optional(),
  composition: CompositionSchema.optional(),
  reference: z.string().url().optional(),
})
export type PhotoSpec = z.infer<typeof PhotoSpecSchema>

/** PhotoSpec with derived px guaranteed (after `derivePixels`). */
export type ResolvedPhotoSpec = PhotoSpec & { width_px: number; height_px: number }

/* -------------------------------------------------------------------------- */
/* PaperSpec                                                                  */
/* -------------------------------------------------------------------------- */

export const PaperSpecSchema = z.object({
  id: z.string().min(1),
  builtin: z.boolean(),
  name: I18nTextSchema,
  alias: z.string().optional(),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  dpi: z.number().int().positive(),
  width_px: z.number().int().positive().optional(),
  height_px: z.number().int().positive().optional(),
})
export type PaperSpec = z.infer<typeof PaperSpecSchema>
export type ResolvedPaperSpec = PaperSpec & { width_px: number; height_px: number }

/* -------------------------------------------------------------------------- */
/* LayoutTemplate (M6 — declared now for forward-compat)                       */
/* -------------------------------------------------------------------------- */

const CellSchema = z.object({
  photoSpecId: z.string(),
  x_mm: z.number(),
  y_mm: z.number(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
})
export type Cell = z.infer<typeof CellSchema>

const ArrangementSchema = z.union([
  z.object({ kind: z.literal('auto-grid') }),
  z.object({ kind: z.literal('manual'), cells: z.array(CellSchema) }),
])

const LayoutSettingsSchema = z.object({
  backgroundColor: z.string().optional(),
  showSeparator: z.boolean().optional(),
  separatorColor: z.string().optional(),
  margin_mm: z.number().nonnegative().optional(),
  gap_mm: z.number().nonnegative().optional(),
  showCutGuides: z.boolean().optional(),
})

export const LayoutTemplateSchema = z.object({
  id: z.string().min(1),
  builtin: z.boolean(),
  paperId: z.string(),
  name: I18nTextSchema,
  items: z.array(
    z.object({
      photoSpecId: z.string(),
      count: z.number().int().positive(),
    }),
  ),
  arrangement: ArrangementSchema,
  settings: LayoutSettingsSchema.optional(),
})
export type LayoutTemplate = z.infer<typeof LayoutTemplateSchema>

/* -------------------------------------------------------------------------- */
/* Frame                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Rectangle in *image pixel* coordinates. Origin top-left, axes
 * pointing right / down. Used by the crop frame, auto-center, and
 * compliance check.
 */
export interface CropFrame {
  x: number
  y: number
  w: number
  h: number
}

/** Detected face from MediaPipe Tasks Vision — pixel coordinates. */
export interface FaceDetection {
  /** Bounding box. */
  bbox: { x: number; y: number; w: number; h: number }
  /**
   * Six MediaPipe keypoints. Order matches the SDK:
   *   0 left-eye  1 right-eye  2 nose-tip  3 mouth-center
   *   4 left-ear  5 right-ear
   */
  keypoints: Array<{ x: number; y: number }>
  /** Detector confidence ∈ [0, 1]. */
  confidence: number
}

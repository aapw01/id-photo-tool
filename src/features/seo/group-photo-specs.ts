/**
 * Pure helper: group built-in photo specs by `category`, preserving
 * the data-source order inside each group. Used by `/sizes` to render
 * the spec catalog as one section per category.
 */

import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import type { PhotoCategory, PhotoSpec } from '@/types/spec'

/** Display order for the category headings on `/sizes`. */
export const PHOTO_CATEGORY_DISPLAY_ORDER: PhotoCategory[] = [
  'cn-id',
  'cn-paper',
  'travel-permit',
  'visa',
  'exam',
  'custom',
]

export interface PhotoSpecGroup {
  category: PhotoCategory
  specs: PhotoSpec[]
}

export function groupPhotoSpecsByCategory(
  specs: readonly PhotoSpec[] = BUILTIN_PHOTO_SPECS,
): PhotoSpecGroup[] {
  const buckets = new Map<PhotoCategory, PhotoSpec[]>()
  for (const spec of specs) {
    const bucket = buckets.get(spec.category)
    if (bucket) bucket.push(spec)
    else buckets.set(spec.category, [spec])
  }
  return PHOTO_CATEGORY_DISPLAY_ORDER.filter((c) => buckets.has(c)).map((category) => ({
    category,
    specs: buckets.get(category)!,
  }))
}

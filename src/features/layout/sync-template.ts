/**
 * Sync the layout template with the user's chosen crop spec.
 *
 * Up until M6 the layout panel ran completely independent of the
 * size-tab spec — the studio default was "5R · 8 × 1-inch" no matter
 * what the user picked next door. That broke the "tool continuity"
 * promise of Pixfit: pick `美国签证` on the size tab, hit the layout
 * tab, and the layout would silently revert to 1-inch sheets.
 *
 * `pickTemplateForSpec` produces a `LayoutTemplate` whose `items`
 * point at the active spec, picking a built-in template when one
 * exists and synthesising a custom-mix otherwise. `estimateMaxCount`
 * caps the synthesised count at the most photos that physically fit
 * the paper under reasonable defaults.
 */

import { BUILTIN_LAYOUT_TEMPLATES } from '@/data/layout-templates'
import type { LayoutTemplate, PaperSpec, PhotoSpec } from '@/types/spec'

const SYNC_TEMPLATE_PREFIX = 'synced-'
const DEFAULT_MARGIN_MM = 5
const DEFAULT_GAP_MM = 2
const MIN_COUNT = 1
const MAX_COUNT = 24

/** Recognise templates that this helper synthesised. */
export function isSyncedTemplate(template: LayoutTemplate): boolean {
  return template.id.startsWith(SYNC_TEMPLATE_PREFIX)
}

/**
 * Largest count of `spec` photos that fits on `paper` under the
 * default margin/gap. Tries both orientations of the spec to pick the
 * better grid (portrait vs landscape rotation isn't free, but the
 * `auto-grid` packer already handles that — the count here is just an
 * upper bound for synthesis).
 */
export function estimateMaxCount(spec: PhotoSpec, paper: PaperSpec): number {
  const usableW = paper.width_mm - DEFAULT_MARGIN_MM * 2
  const usableH = paper.height_mm - DEFAULT_MARGIN_MM * 2

  // Two orientations: photo upright, or rotated 90 deg.
  const grid = (cellW: number, cellH: number): number => {
    if (cellW <= 0 || cellH <= 0) return 0
    const cols = Math.floor((usableW + DEFAULT_GAP_MM) / (cellW + DEFAULT_GAP_MM))
    const rows = Math.floor((usableH + DEFAULT_GAP_MM) / (cellH + DEFAULT_GAP_MM))
    return Math.max(0, cols) * Math.max(0, rows)
  }
  const upright = grid(spec.width_mm, spec.height_mm)
  const rotated = grid(spec.height_mm, spec.width_mm)
  const best = Math.max(upright, rotated)
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, best))
}

/**
 * Pick or synthesise a `LayoutTemplate` whose items contain `spec`.
 *
 * Decision order:
 *
 *   1. Built-in single-spec template on the same paper — preferred
 *      because it carries hand-tuned margin/gap/cut-guide settings.
 *   2. Built-in template on the same paper whose first item is the
 *      spec — covers mix templates that still showcase the user's
 *      pick prominently.
 *   3. Synthesised custom-mix with auto-grid layout at the maximum
 *      reasonable count.
 */
export function pickTemplateForSpec(spec: PhotoSpec, paper: PaperSpec): LayoutTemplate {
  const builtinSingle = BUILTIN_LAYOUT_TEMPLATES.find(
    (t) => t.paperId === paper.id && t.items.length === 1 && t.items[0]?.photoSpecId === spec.id,
  )
  if (builtinSingle) return builtinSingle

  const builtinMixWithSpecFirst = BUILTIN_LAYOUT_TEMPLATES.find(
    (t) => t.paperId === paper.id && t.items[0]?.photoSpecId === spec.id,
  )
  if (builtinMixWithSpecFirst) return builtinMixWithSpecFirst

  const count = estimateMaxCount(spec, paper)
  const id = `${SYNC_TEMPLATE_PREFIX}${spec.id}-on-${paper.id}`
  const specName = spec.name
  return {
    id,
    builtin: false,
    paperId: paper.id,
    name: {
      zh: `${paper.name.zh} · ${count} 张 ${specName.zh}`,
      'zh-Hant': `${paper.name['zh-Hant']} · ${count} 張 ${specName['zh-Hant']}`,
      en: `${paper.name.en} · ${count} × ${specName.en}`,
    },
    items: [{ photoSpecId: spec.id, count }],
    arrangement: { kind: 'auto-grid' },
    settings: {
      margin_mm: DEFAULT_MARGIN_MM,
      gap_mm: DEFAULT_GAP_MM,
      showSeparator: true,
      showCutGuides: false,
    },
  }
}

/**
 * True when `template` already covers `spec` on `paper` — i.e. no
 * sync is needed. Used to gate the sync effect so it doesn't undo a
 * user's manual template selection.
 */
export function templateAlreadyCoversSpec(
  template: LayoutTemplate,
  spec: PhotoSpec,
  paper: PaperSpec,
): boolean {
  if (template.paperId !== paper.id) return false
  return template.items.some((it) => it.photoSpecId === spec.id)
}

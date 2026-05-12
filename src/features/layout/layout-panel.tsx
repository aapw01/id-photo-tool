'use client'

/**
 * Right-rail panel for the studio's layout tab.
 *
 * Stacks four sub-panels (paper picker, layout template picker, mixed
 * editor, settings) plus the download actions. Each subpanel is a
 * thin wrapper around `useLayoutStore` so unrelated tabs can ignore
 * the layout state entirely.
 *
 * The panel also owns the "carry the size-tab spec into layout" sync
 * effect: when the user picks `美国签证` (or any spec) on the size
 * tab, the layout default — historically a generic "5R · 8 × 1-inch"
 * — needs to reflect the actual spec they're working on. We sync
 * once per (spec, paper) combination so subsequent manual template
 * picks aren't undone.
 */

import { useEffect, useRef } from 'react'

import type { BgColor } from '@/features/background/composite'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { LayoutActions } from './layout-actions'
import { LayoutSettings } from './layout-settings'
import { LayoutTemplatePicker } from './layout-template-picker'
import { MixedEditor } from './mixed-editor'
import { PaperPicker } from './paper-picker'
import { useLayoutStore } from './store'
import { pickTemplateForSpec, templateAlreadyCoversSpec } from './sync-template'

interface LayoutPanelProps {
  bitmap: ImageBitmap
  mask: ImageData | null
  bg: BgColor
  activeCropSpec: PhotoSpec | null
  activeCropFrame: CropFrame | null
}

export function LayoutPanel({
  bitmap,
  mask,
  bg,
  activeCropSpec,
  activeCropFrame,
}: LayoutPanelProps) {
  useSyncTemplateWithCropSpec(activeCropSpec)

  return (
    <div className="space-y-4">
      <PaperPicker />
      <LayoutTemplatePicker activeCropSpec={activeCropSpec} />
      <MixedEditor activeCropSpec={activeCropSpec} />
      <LayoutSettings />
      <LayoutActions
        bitmap={bitmap}
        mask={mask}
        bg={bg}
        activeCropSpec={activeCropSpec}
        activeCropFrame={activeCropFrame}
      />
    </div>
  )
}

/**
 * Drive the layout template from the active crop spec.
 *
 * On the first render where `(cropSpec, paper)` differs from the last
 * sync we ran, replace the template with a sensible one for that
 * combination (built-in single-spec template when available,
 * synthesised custom-mix otherwise). Subsequent renders that keep the
 * same `(spec, paper)` are no-ops so any manual template the user
 * picked sticks.
 */
function useSyncTemplateWithCropSpec(cropSpec: PhotoSpec | null): void {
  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const setTemplate = useLayoutStore((s) => s.setTemplate)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!cropSpec) return
    const key = `${cropSpec.id}::${paper.id}`
    if (syncedFor.current === key) return
    syncedFor.current = key
    if (templateAlreadyCoversSpec(template, cropSpec, paper)) return
    setTemplate(pickTemplateForSpec(cropSpec, paper))
  }, [cropSpec, paper, template, setTemplate])
}

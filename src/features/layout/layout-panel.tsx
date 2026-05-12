'use client'

/**
 * Right-rail panel for the studio's layout tab.
 *
 * Stacks four sub-panels (paper picker, layout template picker, mixed
 * editor, settings) plus the download actions. Each subpanel is a
 * thin wrapper around `useLayoutStore` so unrelated tabs can ignore
 * the layout state entirely.
 */

import type { BgColor } from '@/features/background/composite'
import type { CropFrame, PhotoSpec } from '@/types/spec'

import { LayoutActions } from './layout-actions'
import { LayoutSettings } from './layout-settings'
import { LayoutTemplatePicker } from './layout-template-picker'
import { MixedEditor } from './mixed-editor'
import { PaperPicker } from './paper-picker'

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
  return (
    <div className="space-y-4">
      <PaperPicker />
      <LayoutTemplatePicker />
      <MixedEditor />
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

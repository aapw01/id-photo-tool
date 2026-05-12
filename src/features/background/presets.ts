import type { BgColor } from './composite'

/**
 * Five canonical swatches surfaced in the background panel.
 *
 * Hex values come from PRD §5.3:
 *   - 标准白 / White        #FFFFFF
 *   - 标准蓝 / Visa blue    #438EDB
 *   - 标准红 / ID red       #D9342B
 *   - 浅灰   / Light gray   #F5F5F5
 *   - Transparent           — checkered fill, exports as alpha PNG
 *
 * Order matches the design wireframe (transparent first, then light
 * → dark to read left-to-right naturally).
 */
export interface PresetSwatch {
  id: 'transparent' | 'white' | 'blue' | 'red' | 'lightGray'
  color: BgColor
}

export const PRESET_SWATCHES: readonly PresetSwatch[] = [
  { id: 'transparent', color: { kind: 'transparent' } },
  { id: 'white', color: { kind: 'color', hex: '#FFFFFF' } },
  { id: 'blue', color: { kind: 'color', hex: '#438EDB' } },
  { id: 'red', color: { kind: 'color', hex: '#D9342B' } },
  { id: 'lightGray', color: { kind: 'color', hex: '#F5F5F5' } },
]

export function isSameColor(a: BgColor, b: BgColor): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'transparent') return true
  return a.hex.toLowerCase() === (b as { kind: 'color'; hex: string }).hex.toLowerCase()
}

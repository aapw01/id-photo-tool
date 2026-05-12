'use client'

/**
 * `ColorSwatch` — circular colour-chip button used in the background
 * panel and the recent-colour strip.
 *
 * Visual contract (DESIGN.md §5.2):
 *   - 36×36 circle with a 1 px stone-200 border
 *   - Selected state adds a double emerald ring (2 px gap)
 *   - The transparent swatch shows a checkerboard pattern
 *
 * Accessibility: rendered as a real <button> so it is keyboard-
 * activatable; consumers pass an `aria-label` that announces the
 * colour by its localised name (e.g. "Visa blue").
 */

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { BgColor } from './composite'

interface ColorSwatchProps {
  color: BgColor
  selected: boolean
  label: string
  onSelect: (color: BgColor) => void
  size?: 'sm' | 'md'
}

const CHECKERBOARD =
  'linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)'

export function ColorSwatch({ color, selected, label, onSelect, size = 'md' }: ColorSwatchProps) {
  const isTransparent = color.kind === 'transparent'

  const dim = size === 'sm' ? 28 : 36
  const checkSize = size === 'sm' ? 'size-3' : 'size-4'

  const style: React.CSSProperties = isTransparent
    ? {
        width: dim,
        height: dim,
        backgroundImage: CHECKERBOARD,
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
      }
    : {
        width: dim,
        height: dim,
        backgroundColor: color.hex,
      }

  // Pick a contrasting check colour: white on dark fills, dark on light.
  // Cheap luma estimate; transparent swatch always uses neutral.
  let checkClass = 'text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.4)]'
  if (!isTransparent) {
    const rgb = hexToRgb(color.hex)
    if (rgb && (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 160) {
      checkClass = 'text-[var(--color-text)] drop-shadow-none'
    }
  } else {
    checkClass = 'text-[var(--color-text)]'
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={() => onSelect(color)}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border border-[var(--color-border)] transition-all',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] focus-visible:outline-none',
        'hover:scale-[1.05] active:scale-[0.97]',
        selected &&
          'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-surface)]',
      )}
      style={style}
      data-swatch-kind={color.kind}
    >
      {selected ? <Check className={cn(checkSize, checkClass)} aria-hidden /> : null}
    </button>
  )
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return null
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  }
}

'use client'

/**
 * Right-rail panel that drives the Studio's background colour.
 *
 * Three sections:
 *
 *   1. Presets — five canonical swatches (transparent / white / visa
 *      blue / id red / light gray).
 *   2. Custom — a `<input type="color">` paired with a hex text input,
 *      so users can type `#3a3a3a` or use the native picker. Submitting
 *      registers the colour and adds it to the recent list.
 *   3. Recent — most-recently used colour stack, max 8, persisted to
 *      localStorage via the store.
 *
 * Optional `<ComparisonToggle />` row sits at the bottom and flips
 * the "before / after" slider on the canvas via a parent-controlled
 * prop.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2, Sparkles } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { SegmentationState } from '@/features/segmentation/use-segmentation'
import { NextStepCTA } from '@/features/studio/next-step-cta'
import { useStudioTabStore } from '@/features/studio/studio-tab-store'
import { cn } from '@/lib/utils'

import { ColorSwatch } from './color-swatch'
import { parseHex, toHex, type BgColor } from './composite'
import { isSameColor, PRESET_SWATCHES } from './presets'
import { useBackgroundStore } from './store'

interface BackgroundPanelProps {
  /** True once the segmentation worker has produced a mask. */
  hasMask: boolean
  segmentationState: SegmentationState
  onStartSegmentation: () => void
  showCompare: boolean
  onToggleCompare: (v: boolean) => void
}

export function BackgroundPanel({
  hasMask,
  segmentationState,
  onStartSegmentation,
  showCompare,
  onToggleCompare,
}: BackgroundPanelProps) {
  const t = useTranslations('Background')
  const tNames = useTranslations('Background.presetNames')
  const tStudio = useTranslations('Studio.cta')

  const setTab = useStudioTabStore((s) => s.setTab)

  const current = useBackgroundStore((s) => s.current)
  const recent = useBackgroundStore((s) => s.recent)
  const setColor = useBackgroundStore((s) => s.setColor)

  const [hexDraft, setHexDraft] = useState<string>(() =>
    current.kind === 'color' ? current.hex : '#FFFFFF',
  )

  const draftRgb = parseHex(hexDraft)
  const draftValid = draftRgb !== null
  const draftHex = draftRgb ? toHex(draftRgb) : '#ffffff'

  const applyDraft = () => {
    if (!draftRgb) return
    setColor({ kind: 'color', hex: toHex(draftRgb) })
  }

  const busySeg = segmentationState === 'loading-model' || segmentationState === 'inferring'

  return (
    <section className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
      </header>

      {!hasMask ? (
        <div className="space-y-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-divider)] p-3">
          <div className="flex items-start gap-2">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-dk)]"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--color-text)]">{t('cutout.title')}</p>
              <p className="text-xs text-[var(--color-text-mute)]">{t('cutout.hint')}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onStartSegmentation}
            disabled={busySeg}
            className="w-full"
            style={{ touchAction: 'manipulation' }}
            // Hovering / focusing this CTA is the strongest signal the
            // user is about to need segmentation. `SegmentationPrewarm`
            // listens for the attribute and starts the model download
            // a beat ahead of the click.
            data-warmup-segmentation=""
          >
            {busySeg ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busySeg ? t('cutout.running') : t('cutout.start')}
          </Button>
        </div>
      ) : null}

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-mute)]">{t('presets')}</p>
        <div className="flex flex-wrap gap-3">
          {PRESET_SWATCHES.map((p) => (
            <ColorSwatch
              key={p.id}
              color={p.color}
              selected={isSameColor(current, p.color)}
              label={tNames(p.id)}
              onSelect={setColor}
            />
          ))}
        </div>
      </div>

      {/* Custom hex + native picker */}
      <div className="space-y-2">
        <Label htmlFor="bg-hex" className="text-xs text-[var(--color-text-mute)]">
          {t('custom')}
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t('hexInputLabel')}
            value={draftHex}
            onChange={(e) => {
              setHexDraft(e.target.value)
              setColor({ kind: 'color', hex: e.target.value })
            }}
            className="h-9 w-9 cursor-pointer rounded-md border border-[var(--color-border)] bg-transparent p-0"
            style={{ appearance: 'none' }}
          />
          <Input
            id="bg-hex"
            value={hexDraft}
            placeholder={t('hexInputPlaceholder')}
            onChange={(e) => setHexDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyDraft()
              }
            }}
            aria-invalid={!draftValid}
            spellCheck={false}
            className="flex-1 font-mono text-xs"
          />
          <Button size="sm" onClick={applyDraft} disabled={!draftValid}>
            {t('apply')}
          </Button>
        </div>
      </div>

      {/* Recently used */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-mute)]">{t('recent')}</p>
        {recent.length === 0 ? (
          <p className="text-xs text-[var(--color-text-weak)]">{t('recentEmpty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recent.map((hex) => {
              const color: BgColor = { kind: 'color', hex }
              return (
                <ColorSwatch
                  key={hex}
                  color={color}
                  selected={isSameColor(current, color)}
                  label={hex.toUpperCase()}
                  onSelect={setColor}
                  size="sm"
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Before / after toggle */}
      <div
        className={cn(
          'flex items-start justify-between gap-3 rounded-md border border-dashed border-[var(--color-border)] p-3',
        )}
      >
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{t('compare')}</p>
          <p className="text-xs text-[var(--color-text-mute)]">{t('compareHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showCompare}
          onClick={() => onToggleCompare(!showCompare)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] focus-visible:outline-none',
            showCompare ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-divider)]',
          )}
        >
          <span
            className={cn(
              'inline-block size-4 transform rounded-full bg-white shadow transition-transform',
              showCompare ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {/* "Not satisfied → run again" affordance. Lives next to the
       * compare slider so the user can verify edge quality and re-run
       * in the same panel without hunting for the legacy "retry"
       * button that used to sit in the file-info card. */}
      {hasMask ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--color-text-mute)]">{t('retry.hint')}</span>
          <button
            type="button"
            onClick={onStartSegmentation}
            disabled={busySeg}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-[var(--color-primary)] underline-offset-2 transition-colors',
              'hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
              busySeg && 'cursor-not-allowed opacity-50',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            {busySeg ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            {t('retry.action')}
          </button>
        </div>
      ) : null}

      <Button variant="default" className="w-full" onClick={() => setTab('export')}>
        <Download className="size-4" aria-hidden />
        {tStudio('export')}
      </Button>

      <NextStepCTA current="background" />
    </section>
  )
}

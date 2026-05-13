'use client'

/**
 * The right-rail spec picker for the size tab.
 *
 * Sections (top → bottom):
 *   1. Search bar — fuzzy-matches against the localised name and a few
 *      auxiliary fields (region code, alias).
 *   2. Category chips — horizontal scroll; "All" + the 5 builtin
 *      categories. Tapping a chip narrows the visible list.
 *   3. Custom-size inline form — a width / height / DPI quick form. The
 *      Apply button builds an *ephemeral* PhotoSpec and pipes it into
 *      the crop store; no persistence so the no-login tool stays
 *      single-page. Replaces the previous "/specs" detour that broke
 *      the in-studio flow.
 *   4. Built-in spec list — flag + name + size subtitle; the active
 *      one gets an emerald ring and a tick.
 *   5. Selected-spec info card — physical & pixel size, recommended
 *      background, file rules if any.
 *   6. Bottom CTA — "Export now" jumps the Studio to the Export tab.
 *
 * The picker is purely declarative: it reads `useCropStore()` and calls
 * `setSpec` / route changes. Coupling to face detection / auto-center
 * lives up in StudioWorkspace.
 */

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Download, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RegionFlag } from '@/components/region-flag'
import { NextStepCTA } from '@/features/studio/next-step-cta'
import { useStudioTabStore } from '@/features/studio/studio-tab-store'
import { useEffectivePhotoSpecs } from '@/features/spec-manager/store'
import { localizeText } from '@/lib/i18n-text'
import { derivePixels, MM_PER_INCH } from '@/lib/spec-units'
import { cn } from '@/lib/utils'
import type { PhotoCategory, PhotoSpec } from '@/types/spec'

import { useCropStore } from './spec-store'

type Filter = 'all' | PhotoCategory

const FILTERS: readonly Filter[] = ['all', 'cn-id', 'cn-paper', 'travel-permit', 'visa', 'exam']

/**
 * Unit options for the inline custom-size form. Order is the picker
 * order; `mm` stays first so the default matches the previous
 * behaviour for users who never open the dropdown.
 */
const CUSTOM_UNITS = ['mm', 'cm', 'inch', 'px'] as const
type CustomUnit = (typeof CUSTOM_UNITS)[number]

const CUSTOM_DEFAULTS: Record<CustomUnit, { w: number; h: number; step: number }> = {
  mm: { w: 35, h: 49, step: 1 },
  cm: { w: 3.5, h: 4.9, step: 0.1 },
  inch: { w: 1.4, h: 1.9, step: 0.1 },
  px: { w: 413, h: 579, step: 1 },
}

/** Inclusive min / max per unit — keeps custom specs out of silly territory. */
const CUSTOM_BOUNDS: Record<CustomUnit, { min: number; max: number }> = {
  mm: { min: 5, max: 500 },
  cm: { min: 0.5, max: 50 },
  inch: { min: 0.2, max: 20 },
  px: { min: 50, max: 8000 },
}

const CUSTOM_DPIS = [200, 300, 600] as const
const CUSTOM_DPI_DEFAULT = 300
/** Default DPI we synthesise when the user types px directly. */
const CUSTOM_PX_DPI = 300

export function SpecPicker() {
  const t = useTranslations('Crop')
  const tCat = useTranslations('Crop.categories')
  const tStudio = useTranslations('Studio.cta')
  const locale = useLocale()

  const activeSpec = useCropStore((s) => s.spec)
  const setSpec = useCropStore((s) => s.setSpec)

  const setTab = useStudioTabStore((s) => s.setTab)

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const [customUnit, setCustomUnit] = useState<CustomUnit>('mm')
  const [customW, setCustomW] = useState<number>(CUSTOM_DEFAULTS.mm.w)
  const [customH, setCustomH] = useState<number>(CUSTOM_DEFAULTS.mm.h)
  const [customDpi, setCustomDpi] = useState<number>(CUSTOM_DPI_DEFAULT)

  // Merged builtin + user-saved specs. Matches `/specs` admin so the
  // user-defined sizes the user created over there finally show up in
  // the studio main flow.
  const effectiveSpecs = useEffectivePhotoSpecs()

  const visibleSpecs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return effectiveSpecs.filter((s) => {
      if (filter !== 'all' && s.category !== filter) return false
      if (!q) return true
      const hay = [s.name.zh, s.name['zh-Hant'], s.name.en, s.id, s.region ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [filter, query, effectiveSpecs])

  const bounds = CUSTOM_BOUNDS[customUnit]
  const inputStep = CUSTOM_DEFAULTS[customUnit].step
  const customValid =
    Number.isFinite(customW) &&
    Number.isFinite(customH) &&
    customW >= bounds.min &&
    customW <= bounds.max &&
    customH >= bounds.min &&
    customH <= bounds.max

  /**
   * Swap the unit and reset the inputs to that unit's defaults. We
   * intentionally do NOT try to convert the typed values across units —
   * that surprises users (typing "35" in mm shouldn't silently become
   * "3.5 cm" when they switch unit) and the conversion would have to
   * undo and reapply rounding each step. Defaults are tuned to land on
   * the typical 2-inch size in each unit.
   */
  const changeUnit = (next: CustomUnit) => {
    if (next === customUnit) return
    setCustomUnit(next)
    setCustomW(CUSTOM_DEFAULTS[next].w)
    setCustomH(CUSTOM_DEFAULTS[next].h)
  }

  const applyCustom = () => {
    if (!customValid) return
    // Convert the typed value into mm + an effective DPI so the rest
    // of the pipeline (which speaks mm + DPI everywhere — see
    // `derivePixels`) doesn't need to know about units. For px input
    // we synthesise a fixed DPI so `mmToPx` rounds back to exactly the
    // pixel count the user asked for.
    let widthMm: number
    let heightMm: number
    let dpi: number
    let displayLabel: string
    switch (customUnit) {
      case 'cm': {
        widthMm = customW * 10
        heightMm = customH * 10
        dpi = customDpi
        displayLabel = `${formatNumber(customW)}×${formatNumber(customH)}cm`
        break
      }
      case 'inch': {
        widthMm = customW * MM_PER_INCH
        heightMm = customH * MM_PER_INCH
        dpi = customDpi
        displayLabel = `${formatNumber(customW)}×${formatNumber(customH)}″`
        break
      }
      case 'px': {
        dpi = CUSTOM_PX_DPI
        // Round to whole pixels in px mode so the saved spec's
        // `width_px` / `height_px` agree with what the user typed.
        const wPx = Math.round(customW)
        const hPx = Math.round(customH)
        widthMm = (wPx * MM_PER_INCH) / dpi
        heightMm = (hPx * MM_PER_INCH) / dpi
        displayLabel = `${wPx}×${hPx}px`
        break
      }
      case 'mm':
      default: {
        widthMm = customW
        heightMm = customH
        dpi = customDpi
        displayLabel = `${formatNumber(customW)}×${formatNumber(customH)}mm`
        break
      }
    }
    const prefix = t('customNamePrefix')
    const displayName = `${prefix} ${displayLabel}`
    const customSpec: PhotoSpec = {
      id: `custom-${Date.now()}`,
      builtin: false,
      category: 'custom',
      name: {
        zh: displayName,
        'zh-Hant': displayName,
        en: displayName,
      },
      width_mm: widthMm,
      height_mm: heightMm,
      dpi,
    }
    setSpec(customSpec)
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-weak)]"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs transition-colors',
              filter === f
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-divider)] text-[var(--color-text-mute)] hover:bg-[var(--color-border)]',
            )}
          >
            {f === 'all' ? '∗' : tCat(f as PhotoCategory)}
          </button>
        ))}
      </div>

      {/* Inline custom-size form — replaces the previous /specs detour. */}
      <div className="space-y-2 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-divider)] p-3">
        <p className="text-xs font-medium text-[var(--color-text)]">{t('customSection')}</p>
        <div className="space-y-1">
          <Label htmlFor="custom-unit" className="text-xs text-[var(--color-text-mute)]">
            {t('customUnit')}
          </Label>
          <select
            id="custom-unit"
            value={customUnit}
            onChange={(e) => changeUnit(e.target.value as CustomUnit)}
            className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 font-mono text-xs text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
          >
            {CUSTOM_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`units.${u}` as 'units.mm')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="custom-w" className="text-xs text-[var(--color-text-mute)]">
              {t('customW', { unit: t(`units.${customUnit}` as 'units.mm') })}
            </Label>
            <Input
              id="custom-w"
              type="number"
              min={bounds.min}
              max={bounds.max}
              step={inputStep}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value) || 0)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-h" className="text-xs text-[var(--color-text-mute)]">
              {t('customH', { unit: t(`units.${customUnit}` as 'units.mm') })}
            </Label>
            <Input
              id="custom-h"
              type="number"
              min={bounds.min}
              max={bounds.max}
              step={inputStep}
              value={customH}
              onChange={(e) => setCustomH(Number(e.target.value) || 0)}
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="custom-dpi" className="text-xs text-[var(--color-text-mute)]">
            {t('customDpi')}
          </Label>
          <select
            id="custom-dpi"
            value={customDpi}
            disabled={customUnit === 'px'}
            onChange={(e) => setCustomDpi(Number(e.target.value))}
            className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 font-mono text-xs text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {CUSTOM_DPIS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {customUnit === 'px' ? (
            <p className="text-xs text-[var(--color-text-mute)]">{t('customDpiPxHint')}</p>
          ) : null}
        </div>
        {!customValid ? (
          <p className="text-xs text-[var(--color-warning)]">
            {t('customRangeHint', {
              min: formatNumber(bounds.min),
              max: formatNumber(bounds.max),
              unit: t(`units.${customUnit}` as 'units.mm'),
            })}
          </p>
        ) : null}
        <Button
          size="sm"
          className="w-full"
          onClick={applyCustom}
          disabled={!customValid}
          style={{ touchAction: 'manipulation' }}
        >
          {t('customApply')}
        </Button>
      </div>

      <ul className="max-h-[420px] space-y-1 overflow-y-auto">
        {visibleSpecs.length === 0 ? (
          <li className="p-3 text-center text-sm text-[var(--color-text-weak)]">
            {t('noMatches')}
          </li>
        ) : (
          visibleSpecs.map((spec) => (
            <SpecRow
              key={spec.id}
              spec={spec}
              isActive={activeSpec?.id === spec.id}
              onSelect={setSpec}
              locale={locale}
            />
          ))
        )}
      </ul>

      {activeSpec ? <ActiveSpecCard spec={activeSpec} /> : null}

      <Button variant="default" className="w-full" onClick={() => setTab('export')}>
        <Download className="size-4" aria-hidden />
        {tStudio('export')}
      </Button>

      <NextStepCTA current="size" />
    </section>
  )
}

interface SpecRowProps {
  spec: PhotoSpec
  isActive: boolean
  onSelect: (spec: PhotoSpec) => void
  locale: string
}

function SpecRow({ spec, isActive, onSelect, locale }: SpecRowProps): React.ReactElement {
  const resolved = derivePixels(spec)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(spec)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition-colors',
          'hover:bg-[var(--color-divider)]',
          isActive
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
            : 'border-[var(--color-border)] bg-transparent',
        )}
        aria-pressed={isActive}
      >
        {spec.region ? (
          <RegionFlag countryCode={spec.region} label={spec.region} squared className="size-5" />
        ) : (
          <span className="inline-block size-5 rounded-sm bg-[var(--color-divider)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-text)]">
            {localizeText(spec.name, locale)}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-mute)]">
            {spec.width_mm}×{spec.height_mm} mm · {resolved.width_px}×{resolved.height_px} px
          </p>
        </div>
        {isActive ? (
          <Check className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
        ) : null}
      </button>
    </li>
  )
}

/**
 * Trim trailing zeros from a fractional number so labels read as
 * "1.4" rather than "1.4000000000000001". Whole numbers stay free
 * of an unnecessary decimal point.
 */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)
  return Number(value.toFixed(2)).toString()
}

function ActiveSpecCard({ spec }: { spec: PhotoSpec }): React.ReactElement {
  const t = useTranslations('Crop.stats')
  const locale = useLocale()
  const resolved = derivePixels(spec)
  return (
    <div className="space-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] p-3">
      <p className="text-sm font-medium text-[var(--color-text)]">
        {localizeText(spec.name, locale)}
      </p>
      <p className="font-mono text-xs text-[var(--color-text-mute)]">
        {t('dimensions', {
          w: spec.width_mm,
          h: spec.height_mm,
          wpx: resolved.width_px,
          hpx: resolved.height_px,
        })}{' '}
        · {t('dpi', { dpi: spec.dpi })}
      </p>
      {spec.background?.recommended ? (
        <p className="flex items-center gap-2 text-xs text-[var(--color-text-mute)]">
          <span>{t('bg')}:</span>
          <span
            className="inline-block size-3 rounded-sm border border-[var(--color-border)]"
            style={{ backgroundColor: spec.background.recommended }}
          />
          <span className="font-mono">{spec.background.recommended.toUpperCase()}</span>
        </p>
      ) : null}
      {spec.fileRules?.maxKB ? (
        <p className="font-mono text-xs text-[var(--color-text-mute)]">
          {t('kb', { min: spec.fileRules.minKB ?? 0, max: spec.fileRules.maxKB })}
        </p>
      ) : null}
    </div>
  )
}

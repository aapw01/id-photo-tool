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
import { BUILTIN_PHOTO_SPECS } from '@/data/photo-specs'
import { useStudioTabStore } from '@/features/studio/studio-tab-store'
import { localizeText } from '@/lib/i18n-text'
import { derivePixels } from '@/lib/spec-units'
import { cn } from '@/lib/utils'
import type { PhotoCategory, PhotoSpec } from '@/types/spec'

import { useCropStore } from './spec-store'

type Filter = 'all' | PhotoCategory

const FILTERS: readonly Filter[] = ['all', 'cn-id', 'cn-paper', 'travel-permit', 'visa', 'exam']

const CUSTOM_W_DEFAULT_MM = 35
const CUSTOM_H_DEFAULT_MM = 49
const CUSTOM_DPIS = [200, 300, 600] as const
const CUSTOM_DPI_DEFAULT = 300
const CUSTOM_MM_MIN = 10
const CUSTOM_MM_MAX = 200

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

  const [customW, setCustomW] = useState<number>(CUSTOM_W_DEFAULT_MM)
  const [customH, setCustomH] = useState<number>(CUSTOM_H_DEFAULT_MM)
  const [customDpi, setCustomDpi] = useState<number>(CUSTOM_DPI_DEFAULT)

  const visibleBuiltin = useMemo(() => {
    const q = query.trim().toLowerCase()
    return BUILTIN_PHOTO_SPECS.filter((s) => {
      if (filter !== 'all' && s.category !== filter) return false
      if (!q) return true
      const hay = [s.name.zh, s.name['zh-Hant'], s.name.en, s.id, s.region ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [filter, query])

  const customValid =
    Number.isFinite(customW) &&
    Number.isFinite(customH) &&
    customW >= CUSTOM_MM_MIN &&
    customW <= CUSTOM_MM_MAX &&
    customH >= CUSTOM_MM_MIN &&
    customH <= CUSTOM_MM_MAX

  const applyCustom = () => {
    if (!customValid) return
    const w = Math.round(customW)
    const h = Math.round(customH)
    const prefix = t('customNamePrefix')
    const customSpec: PhotoSpec = {
      id: `custom-${Date.now()}`,
      builtin: false,
      category: 'custom',
      name: {
        zh: `${prefix} ${w}×${h}`,
        'zh-Hant': `${prefix} ${w}×${h}`,
        en: `${prefix} ${w}×${h}`,
      },
      width_mm: w,
      height_mm: h,
      dpi: customDpi,
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
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="custom-w" className="text-xs text-[var(--color-text-mute)]">
              {t('customW')}
            </Label>
            <Input
              id="custom-w"
              type="number"
              min={CUSTOM_MM_MIN}
              max={CUSTOM_MM_MAX}
              step={1}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value) || 0)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-h" className="text-xs text-[var(--color-text-mute)]">
              {t('customH')}
            </Label>
            <Input
              id="custom-h"
              type="number"
              min={CUSTOM_MM_MIN}
              max={CUSTOM_MM_MAX}
              step={1}
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
            onChange={(e) => setCustomDpi(Number(e.target.value))}
            className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 font-mono text-xs text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none"
          >
            {CUSTOM_DPIS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
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
        {visibleBuiltin.length === 0 ? (
          <li className="p-3 text-center text-sm text-[var(--color-text-weak)]">
            {t('noMatches')}
          </li>
        ) : (
          visibleBuiltin.map((spec) => (
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

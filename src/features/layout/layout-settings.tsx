'use client'

/**
 * Layout visual settings — margin/gap, separator, cut guides, background.
 *
 * Mirrors the right-rail "tweak" panels from M3/M4 in look and feel,
 * but talks to `useLayoutStore` directly so changes apply live to the
 * preview.
 */

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import { useLayoutStore } from './store'

export function LayoutSettings() {
  const t = useTranslations('Layout.settings')
  const settings = useLayoutStore((s) => s.settings)
  const setSettings = useLayoutStore((s) => s.setSettings)

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <fieldset className="space-y-3">
        <Field
          label={t('margin')}
          value={settings.margin_mm}
          min={0}
          max={20}
          step={1}
          onChange={(v) => setSettings({ margin_mm: v })}
          suffix="mm"
        />
        <Field
          label={t('gap')}
          value={settings.gap_mm}
          min={0}
          max={20}
          step={1}
          onChange={(v) => setSettings({ gap_mm: v })}
          suffix="mm"
        />

        <Toggle
          label={t('showSeparator')}
          checked={settings.showSeparator}
          onChange={(v) => setSettings({ showSeparator: v })}
        />
        <Toggle
          label={t('showCutGuides')}
          checked={settings.showCutGuides}
          onChange={(v) => setSettings({ showCutGuides: v })}
        />

        <div className="space-y-1">
          <label htmlFor="layout-bg" className="text-xs font-medium text-[var(--color-text)]">
            {t('backgroundColor')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="layout-bg"
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => setSettings({ backgroundColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded-sm border border-[var(--color-border)] bg-transparent"
              aria-label={t('backgroundColor')}
            />
            <code className="font-mono text-xs text-[var(--color-text-mute)]">
              {settings.backgroundColor.toUpperCase()}
            </code>
          </div>
        </div>
      </fieldset>
    </section>
  )
}

interface FieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}

function Field({ label, value, min, max, step, suffix, onChange }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text)]">{label}</span>
        <span className="font-mono text-xs text-[var(--color-text-mute)]">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
        aria-label={label}
      />
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] px-3 py-2',
      )}
    >
      <span className="text-xs text-[var(--color-text)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-primary)]"
      />
    </label>
  )
}

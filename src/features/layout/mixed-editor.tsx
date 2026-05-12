'use client'

/**
 * Manual mixed-photo editor.
 *
 * The user picks an arbitrary set of `{ photoSpecId, count }` pairs
 * and the layout updates live. Treats the current template as a
 * working draft: edits never mutate the built-in template — they
 * produce a synthetic "custom-mix" template that the rest of the
 * studio renders normally.
 */

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Minus, Plus, Trash2 } from 'lucide-react'

import { useEffectivePhotoSpecs } from '@/features/spec-manager/store'
import { localizeText } from '@/lib/i18n-text'
import { cn } from '@/lib/utils'
import type { LayoutTemplate, PhotoSpec } from '@/types/spec'

import { useLayoutStore } from './store'

const CUSTOM_PREFIX = 'custom-mix-'

function isCustomMix(template: LayoutTemplate): boolean {
  return template.id.startsWith(CUSTOM_PREFIX)
}

interface MixedEditorProps {
  activeCropSpec: PhotoSpec | null
}

export function MixedEditor({ activeCropSpec }: MixedEditorProps) {
  const t = useTranslations('Layout.mix')
  const locale = useLocale()

  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const setTemplate = useLayoutStore((s) => s.setTemplate)
  const effectiveSpecs = useEffectivePhotoSpecs()

  const items = template.items

  // The select drop-downs need to include the active inline-custom
  // spec when it isn't already in the effective list — otherwise the
  // user can't add their own size to a mix, or sees a blank label
  // when the synced template already references it.
  const availableSpecs = useMemo<PhotoSpec[]>(() => {
    if (!activeCropSpec) return effectiveSpecs
    if (effectiveSpecs.some((s) => s.id === activeCropSpec.id)) return effectiveSpecs
    return [activeCropSpec, ...effectiveSpecs]
  }, [activeCropSpec, effectiveSpecs])

  function commit(nextItems: LayoutTemplate['items']) {
    if (nextItems.length === 0) {
      // Empty mix isn't allowed; fall back to the existing template
      // unchanged.
      return
    }
    const id = isCustomMix(template) ? template.id : `${CUSTOM_PREFIX}${paper.id}`
    const next: LayoutTemplate = {
      ...template,
      id,
      builtin: false,
      name: {
        zh: t('customName'),
        'zh-Hant': t('customName'),
        en: t('customName'),
      },
      items: nextItems,
      // Keep arrangement & settings from the active template so
      // visual tweaks survive edits.
    }
    setTemplate(next)
  }

  function adjustCount(idx: number, delta: number) {
    const target = items[idx]
    if (!target) return
    const nextCount = Math.max(0, target.count + delta)
    if (nextCount === 0) {
      commit(items.filter((_, i) => i !== idx))
      return
    }
    commit(items.map((it, i) => (i === idx ? { ...it, count: nextCount } : it)))
  }

  function setSpecAt(idx: number, photoSpecId: string) {
    if (items.some((it, i) => i !== idx && it.photoSpecId === photoSpecId)) {
      // Avoid duplicate rows; merge counts instead.
      const merged = items
        .map((it, i) =>
          i === idx
            ? null
            : it.photoSpecId === photoSpecId
              ? { ...it, count: it.count + (items[idx]?.count ?? 0) }
              : it,
        )
        .filter(Boolean) as LayoutTemplate['items']
      commit(merged)
      return
    }
    commit(items.map((it, i) => (i === idx ? { ...it, photoSpecId } : it)))
  }

  function addRow() {
    const used = new Set(items.map((it) => it.photoSpecId))
    const next = availableSpecs.find((s) => !used.has(s.id))
    if (!next) return
    commit([...items, { photoSpecId: next.id, count: 1 }])
  }

  function removeRow(idx: number) {
    commit(items.filter((_, i) => i !== idx))
  }

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
          <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)]',
            'transition-colors hover:bg-[var(--color-divider)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
          )}
        >
          <Plus className="size-3" aria-hidden />
          {t('add')}
        </button>
      </header>

      <ul className="space-y-2">
        {items.map((item, idx) => {
          const spec = availableSpecs.find((s) => s.id === item.photoSpecId)
          return (
            <li
              key={`${item.photoSpecId}-${idx}`}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] p-2"
            >
              <select
                value={item.photoSpecId}
                onChange={(e) => setSpecAt(idx, e.target.value)}
                className="min-w-0 flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
                aria-label={t('selectSpec')}
              >
                {availableSpecs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localizeText(s.name, locale)}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustCount(idx, -1)}
                  aria-label={t('decrease')}
                  className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-[var(--color-text)] hover:bg-[var(--color-divider)]"
                >
                  <Minus className="size-3" aria-hidden />
                </button>
                <span className="w-6 text-center font-mono text-sm text-[var(--color-text)]">
                  {item.count}
                </span>
                <button
                  type="button"
                  onClick={() => adjustCount(idx, 1)}
                  aria-label={t('increase')}
                  className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-[var(--color-text)] hover:bg-[var(--color-divider)]"
                >
                  <Plus className="size-3" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => removeRow(idx)}
                aria-label={t('remove', { name: spec ? localizeText(spec.name, locale) : '' })}
                className="rounded-sm border border-transparent p-1 text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

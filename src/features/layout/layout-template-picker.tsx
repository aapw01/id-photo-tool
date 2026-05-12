'use client'

/**
 * Layout template picker — lists every builtin template compatible
 * with the currently selected paper. When the size-tab spec doesn't
 * have a matching built-in template (e.g. 美国签证 on 5R, or any
 * inline-custom size), the list is prepended with a synthesised
 * "{paper} · N × {spec}" entry so the user can still see something
 * tailored to their pick.
 *
 * The user can choose any entry to override; later sync passes don't
 * undo manual picks (see `useSyncTemplateWithCropSpec` in
 * `layout-panel.tsx`).
 */

import { useEffect, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Layers } from 'lucide-react'

import { useEffectiveLayoutTemplates } from '@/features/spec-manager/store'
import { localizeText } from '@/lib/i18n-text'
import { cn } from '@/lib/utils'
import type { LayoutTemplate, PhotoSpec } from '@/types/spec'

import { useLayoutStore } from './store'
import { isSyncedTemplate, pickTemplateForSpec, templateAlreadyCoversSpec } from './sync-template'

interface LayoutTemplatePickerProps {
  activeCropSpec: PhotoSpec | null
}

export function LayoutTemplatePicker({ activeCropSpec }: LayoutTemplatePickerProps) {
  const t = useTranslations('Layout')
  const locale = useLocale()

  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const setTemplate = useLayoutStore((s) => s.setTemplate)

  // Merged builtin + user-saved templates — picks up everything the
  // user added through `/specs`. Filter to this paper here so the
  // memoised slice below doesn't change identity on unrelated edits.
  const effectiveTemplates = useEffectiveLayoutTemplates()
  const builtins = useMemo(
    () => effectiveTemplates.filter((tpl) => tpl.paperId === paper.id),
    [effectiveTemplates, paper.id],
  )

  // Synthesise an extra "{paper} · N × {active spec}" entry whenever
  // the active crop spec has no built-in template on this paper.
  // Surfaces the user's spec at the top so they don't have to scroll
  // past a list of 1-inch presets to find what they actually picked.
  const synthesised = useMemo<LayoutTemplate | null>(() => {
    if (!activeCropSpec) return null
    const alreadyCovered = builtins.some((tpl) =>
      tpl.items.some((it) => it.photoSpecId === activeCropSpec.id),
    )
    if (alreadyCovered) return null
    return pickTemplateForSpec(activeCropSpec, paper)
  }, [activeCropSpec, builtins, paper])

  const templates = useMemo<LayoutTemplate[]>(() => {
    return synthesised ? [synthesised, ...builtins] : builtins
  }, [synthesised, builtins])

  // If the active template doesn't belong to the active paper, auto-
  // switch to the first compatible template (preferring the
  // size-tab-driven synth when present so we don't fight the sync
  // effect in `layout-panel.tsx`).
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      await null
      if (cancelled) return
      if (templates.length === 0) return
      if (templates.some((tpl) => tpl.id === template.id)) return
      if (activeCropSpec && !templateAlreadyCoversSpec(template, activeCropSpec, paper)) {
        setTemplate(templates[0]!)
        return
      }
      setTemplate(templates[0]!)
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [paper, paper.id, template, templates, setTemplate, activeCropSpec])

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('templates.title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('templates.subtitle')}</p>
      </header>

      {templates.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-mute)]">
          {t('templates.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((tpl) => {
            const isActive = template.id === tpl.id
            const isSynth = isSyncedTemplate(tpl)
            const totalItems = tpl.items.reduce((sum, it) => sum + it.count, 0)
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => setTemplate(tpl)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                    isActive
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
                  )}
                >
                  <Layers className="size-4 shrink-0 text-[var(--color-text-mute)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm text-[var(--color-text)]">
                      <span className="truncate">{localizeText(tpl.name, locale)}</span>
                      {isSynth ? (
                        <span className="shrink-0 rounded-sm bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
                          {t('templates.syncedBadge')}
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-[var(--color-text-mute)]">
                      {t('templates.totalCount', { count: totalItems })}
                    </p>
                  </div>
                  {isActive ? (
                    <Check className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

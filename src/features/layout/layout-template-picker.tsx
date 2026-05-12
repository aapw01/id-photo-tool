'use client'

/**
 * Layout template picker — lists every builtin template compatible
 * with the currently selected paper. The user can also choose
 * "custom mix" to drop down into the manual mixed-photo editor.
 */

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Layers } from 'lucide-react'

import { getLayoutTemplatesForPaper } from '@/data/layout-templates'
import { localizeText } from '@/lib/i18n-text'
import { cn } from '@/lib/utils'

import { useLayoutStore } from './store'

export function LayoutTemplatePicker() {
  const t = useTranslations('Layout')
  const locale = useLocale()

  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const setTemplate = useLayoutStore((s) => s.setTemplate)

  const templates = getLayoutTemplatesForPaper(paper.id)

  // If the active template doesn't belong to the active paper, auto-
  // switch to the first compatible template.
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      await null
      if (cancelled) return
      if (templates.length === 0) return
      if (templates.some((tpl) => tpl.id === template.id)) return
      setTemplate(templates[0]!)
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [paper.id, template.id, templates, setTemplate])

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
                    <p className="truncate text-sm text-[var(--color-text)]">
                      {localizeText(tpl.name, locale)}
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

'use client'

/**
 * "Common combos" quick-pick row that sits above the regular paper /
 * template pickers on the layout tab.
 *
 * The two pickers underneath are great for power users who want to mix
 * and match papers and templates, but most users actually want one of
 * five canonical print-shop orders ("5R with 8× 1-inch", "A4 max 1-
 * inch", ...). Surfacing those as a single-tap row turns a two-step
 * (paper, then template) selection into one tap and prevents the
 * "wait, why don't templates X and Y appear together?" confusion that
 * comes from forgetting to switch paper first.
 *
 * Each combo button pins both `paperId` and `templateId` in a single
 * click. The data is hand-curated rather than computed because the
 * curation order encodes "what does the average user want to see
 * first" — not something the data can carry by itself.
 */

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check } from 'lucide-react'

import { useEffectiveLayoutTemplates, useEffectivePaperSpecs } from '@/features/spec-manager/store'
import { localizeText } from '@/lib/i18n-text'
import { cn } from '@/lib/utils'

import { useLayoutStore } from './store'

interface ComboDef {
  id: string
  paperId: string
  templateId: string
}

// Curated combos in display order. Picked to cover the five most common
// print-shop orders we see in user feedback / pixfit chat groups.
const COMBOS: readonly ComboDef[] = [
  { id: 'A4-1inch', paperId: 'A4', templateId: 'a4-fill-1inch' },
  { id: '5R-8x1inch', paperId: '5R', templateId: '8x1inch-on-5R' },
  { id: '5R-4xpassport', paperId: '5R', templateId: '4xpassport-on-5R' },
  { id: '5R-mixed', paperId: '5R', templateId: 'mix-1inch-2inch-A-on-5R' },
  { id: '6R-8x2inch', paperId: '6R', templateId: '8x2inch-on-6R' },
  { id: '6R-mixed', paperId: '6R', templateId: 'mix-1inch-2inch-B-on-6R' },
]

export function QuickCombos() {
  const t = useTranslations('Layout.combos')
  const locale = useLocale()
  const papers = useEffectivePaperSpecs()
  const templates = useEffectiveLayoutTemplates()
  const paper = useLayoutStore((s) => s.paper)
  const template = useLayoutStore((s) => s.template)
  const setPaper = useLayoutStore((s) => s.setPaper)
  const setTemplate = useLayoutStore((s) => s.setTemplate)

  // Resolve each combo against the live spec lists so we can skip ones
  // whose paper or template was disabled / overridden by a user
  // customization.
  const resolved = useMemo(() => {
    return COMBOS.map((c) => {
      const paperSpec = papers.find((p) => p.id === c.paperId)
      const templateSpec = templates.find((t) => t.id === c.templateId)
      if (!paperSpec || !templateSpec) return null
      return { combo: c, paper: paperSpec, template: templateSpec }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [papers, templates])

  if (resolved.length === 0) return null

  return (
    <section className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {resolved.map(({ combo, paper: comboPaper, template: comboTemplate }) => {
          const isActive = paper.id === comboPaper.id && template.id === comboTemplate.id
          const totalItems = comboTemplate.items.reduce((sum, it) => sum + it.count, 0)
          return (
            <button
              key={combo.id}
              type="button"
              onClick={() => {
                setPaper(comboPaper)
                setTemplate(comboTemplate)
              }}
              aria-pressed={isActive}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
                'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                isActive
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dk)]'
                  : 'border-[var(--color-border)] bg-[var(--color-divider)] text-[var(--color-text)] hover:bg-[var(--color-border)]',
              )}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                {localizeText(comboPaper.name, locale)}
                {isActive ? <Check className="size-3" aria-hidden /> : null}
              </span>
              <span className="text-[10px] text-[var(--color-text-mute)]">
                {t('count', { count: totalItems })} · {localizeText(comboTemplate.name, locale)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

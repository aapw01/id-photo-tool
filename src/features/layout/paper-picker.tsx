'use client'

/**
 * Paper picker — renders the seven built-in paper specs as a grid of
 * card-style buttons. Each card shows a tiny scaled preview so users
 * can eyeball the proportion before committing.
 */

import { useLocale, useTranslations } from 'next-intl'
import { Check } from 'lucide-react'

import { BUILTIN_PAPER_SPECS } from '@/data/paper-specs'
import { localizeText } from '@/lib/i18n-text'
import { cn } from '@/lib/utils'
import type { PaperSpec } from '@/types/spec'

import { useLayoutStore } from './store'

// Each preview cell is sized so the largest paper fits inside a
// 64-pixel-wide box; smaller papers shrink proportionally.
const MAX_PREVIEW_PX = 64

function previewSize(paper: PaperSpec): { width: number; height: number } {
  const maxDim = Math.max(...BUILTIN_PAPER_SPECS.map((p) => Math.max(p.width_mm, p.height_mm)))
  const ratio = MAX_PREVIEW_PX / maxDim
  return {
    width: Math.max(8, Math.round(paper.width_mm * ratio)),
    height: Math.max(8, Math.round(paper.height_mm * ratio)),
  }
}

export function PaperPicker() {
  const t = useTranslations('Paper')
  const locale = useLocale()
  const paper = useLayoutStore((s) => s.paper)
  const setPaper = useLayoutStore((s) => s.setPaper)

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <header>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>

      <ul className="grid grid-cols-2 gap-2">
        {BUILTIN_PAPER_SPECS.map((p) => {
          const isActive = paper.id === p.id
          const preview = previewSize(p)
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPaper(p)}
                aria-pressed={isActive}
                className={cn(
                  'flex w-full flex-col items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
                )}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-sm text-[var(--color-text)]">
                    {localizeText(p.name, locale)}
                  </span>
                  {isActive ? (
                    <Check className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-sm border border-[var(--color-border)] bg-white"
                    style={{ width: preview.width, height: preview.height }}
                    aria-hidden
                  />
                  <span className="font-mono text-xs text-[var(--color-text-mute)]">
                    {p.width_mm}×{p.height_mm} mm
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

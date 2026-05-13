'use client'

/**
 * First-visit "what do you want to do?" branching banner.
 *
 * The studio used to dump a fresh upload straight into the background
 * tab, even though that's only one of four reasonable next steps. New
 * users who came in wanting print layouts had to discover the right
 * tab themselves. This component renders a compact card with the four
 * top-level intents (Background / Size / Layout / Export) the first
 * time a session sees a photo loaded.
 *
 * Persistence: a single localStorage flag so the banner stops nagging
 * once a user has demonstrated they know the tab strip. We deliberately
 * keep the dismissal at the *user* level rather than per-photo —
 * showing it again on every upload would punish power users.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Crop, Download, LayoutGrid, Palette, X } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useStudioTabStore, type StudioTab } from './studio-tab-store'

const STORAGE_KEY = 'pixfit:studio:intent-seen'

interface IntentDef {
  id: StudioTab
  Icon: typeof Palette
  labelKey: 'background' | 'size' | 'layout' | 'export'
}

const INTENTS: readonly IntentDef[] = [
  { id: 'background', Icon: Palette, labelKey: 'background' },
  { id: 'size', Icon: Crop, labelKey: 'size' },
  { id: 'layout', Icon: LayoutGrid, labelKey: 'layout' },
  { id: 'export', Icon: Download, labelKey: 'export' },
]

export function IntentBanner() {
  const t = useTranslations('Studio.intent')
  const tIntents = useTranslations('Studio.intent.choices')

  const setTab = useStudioTabStore((s) => s.setTab)

  // Persist the dismissed-state so the banner doesn't re-appear every
  // upload — most users only need the orientation hint once.
  const [seen, setSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!seen) return
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Storage blocked (private mode / quotas) — the banner just stays
      // visible until the user dismisses it, which is fine.
    }
  }, [seen])

  const choose = useCallback(
    (id: StudioTab) => {
      setTab(id)
      setSeen(true)
    },
    [setTab],
  )

  if (seen) return null

  return (
    <section
      aria-label={t('title')}
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        'relative shadow-[var(--shadow-sm)]',
      )}
    >
      <button
        type="button"
        onClick={() => setSeen(true)}
        aria-label={t('dismiss')}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)]"
      >
        <X className="size-4" aria-hidden />
      </button>
      <header className="mb-3 space-y-1 pr-8">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{t('title')}</h3>
        <p className="text-xs text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INTENTS.map(({ id, Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'flex flex-col items-start gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-divider)] px-3 py-2 text-left transition-colors',
              'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
            )}
          >
            <Icon className="size-4 text-[var(--color-primary-dk)]" aria-hidden />
            <span className="text-sm font-medium text-[var(--color-text)]">
              {tIntents(`${labelKey}.label` as 'background.label')}
            </span>
            <span className="text-xs text-[var(--color-text-mute)]">
              {tIntents(`${labelKey}.hint` as 'background.hint')}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

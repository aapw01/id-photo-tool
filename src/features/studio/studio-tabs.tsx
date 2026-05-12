'use client'

/**
 * Studio top-bar tab switcher.
 *
 * Four tabs map to M3 (`background`, `export`) and future milestones
 * (`size` → M4, `layout` → M6). Future tabs are visible but disabled
 * with a "Coming soon" tooltip so users see the roadmap.
 *
 * Keyboard: ArrowLeft / ArrowRight cycle through enabled tabs;
 * Home / End jump to the first / last enabled tab.
 */

import { useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useStudioTabStore, type StudioTab } from './studio-tab-store'

interface TabDef {
  id: StudioTab
  labelKey: 'background' | 'size' | 'layout' | 'export'
  available: boolean
}

const TABS: readonly TabDef[] = [
  { id: 'background', labelKey: 'background', available: true },
  { id: 'size', labelKey: 'size', available: true },
  { id: 'layout', labelKey: 'layout', available: true },
  { id: 'export', labelKey: 'export', available: true },
]

export function StudioTabs() {
  const t = useTranslations('Studio.tabs')
  const tab = useStudioTabStore((s) => s.tab)
  const setTab = useStudioTabStore((s) => s.setTab)

  const refs = useRef<Record<StudioTab, HTMLButtonElement | null>>({
    background: null,
    size: null,
    layout: null,
    export: null,
  })

  const enabledIds = TABS.filter((x) => x.available).map((x) => x.id)

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const i = enabledIds.indexOf(tab)
      if (i < 0) return
      let next: StudioTab | null = null
      if (e.key === 'ArrowLeft') {
        next = enabledIds[(i - 1 + enabledIds.length) % enabledIds.length]!
      } else if (e.key === 'ArrowRight') {
        next = enabledIds[(i + 1) % enabledIds.length]!
      } else if (e.key === 'Home') {
        next = enabledIds[0]!
      } else if (e.key === 'End') {
        next = enabledIds[enabledIds.length - 1]!
      }
      if (next) {
        e.preventDefault()
        setTab(next)
        refs.current[next]?.focus()
      }
    },
    [enabledIds, tab, setTab],
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div
        role="tablist"
        aria-label="Studio sections"
        onKeyDown={handleKey}
        className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      >
        {TABS.map((def) => {
          const isActive = def.id === tab
          const button = (
            <button
              type="button"
              ref={(el) => {
                refs.current[def.id] = el
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={!def.available}
              onClick={() => def.available && setTab(def.id)}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-full px-4 text-sm transition-colors',
                'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
                isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-mute)] hover:bg-[var(--color-divider)]',
                !def.available && 'opacity-50 hover:bg-transparent',
              )}
            >
              {t(def.labelKey)}
            </button>
          )
          if (def.available) return <span key={def.id}>{button}</span>
          return (
            <Tooltip key={def.id}>
              <TooltipTrigger asChild>
                <span tabIndex={-1}>{button}</span>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

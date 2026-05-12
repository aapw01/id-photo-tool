'use client'

/**
 * "下一步" call-to-action button that sits at the bottom of each
 * non-final studio panel and advances the workflow stepper.
 *
 * The Studio's four tabs (`background → size → layout → export`)
 * form a linear workflow. The top-bar stepper lets users jump
 * anywhere, but the most common journey is left-to-right. Surfacing
 * a labelled next-step CTA inside the panel content removes one
 * "where do I go now?" hop and makes the workflow obvious without
 * trapping users in wizard navigation.
 *
 * `current` is intentionally typed as the three non-terminal tabs;
 * the export tab is the last step and has no next CTA.
 */

import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useStudioTabStore, type StudioTab } from './studio-tab-store'

type NextStepSource = 'background' | 'size' | 'layout'

const NEXT_BY_CURRENT: Record<NextStepSource, StudioTab> = {
  background: 'size',
  size: 'layout',
  layout: 'export',
}

const LABEL_KEY_BY_NEXT: Record<StudioTab, 'toSize' | 'toLayout' | 'toExport'> = {
  background: 'toSize',
  size: 'toSize',
  layout: 'toLayout',
  export: 'toExport',
}

interface NextStepCTAProps {
  /** The panel currently rendering the CTA. */
  current: NextStepSource
}

export function NextStepCTA({ current }: NextStepCTAProps) {
  const t = useTranslations('Studio.nextStep')
  const next = NEXT_BY_CURRENT[current]
  const labelKey = LABEL_KEY_BY_NEXT[next]

  const handleClick = () => {
    useStudioTabStore.getState().setTab(next)
    // After switching tabs the panel content can land below the fold
    // on smaller viewports; nudge the page to top so users actually
    // see the panel they were just sent to.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <Button
      variant="default"
      className="w-full"
      onClick={handleClick}
      style={{ touchAction: 'manipulation' }}
    >
      <span>{t(labelKey)}</span>
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  )
}

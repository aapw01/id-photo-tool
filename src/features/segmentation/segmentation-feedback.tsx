'use client'

/**
 * Visual + toast feedback for the segmentation lifecycle.
 *
 * Mount this once on any page that consumes useSegmentation actively
 * (e.g. /studio). It does two things:
 *
 *   1. Subscribes to error transitions and surfaces them via `sonner`
 *      using the i18n strings registered in T11.
 *   2. Renders a small floating progress strip while the model is
 *      loading or inference is running. Hidden in idle / ready / error
 *      states.
 *
 * The Toaster element itself lives in the locale layout (T14); this
 * component just calls `toast()`.
 */

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { messageKey } from './errors'
import { useSegmentation } from './use-segmentation'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SegmentationFeedback() {
  const { state, progress, error, backend } = useSegmentation()
  const tStates = useTranslations('Segmentation.states')
  const tProgress = useTranslations('Segmentation.progress')
  const tBackend = useTranslations('Segmentation.backend')
  const tErrors = useTranslations('Segmentation.errors')

  // Toast only on the leading edge of each error so a re-render with
  // the same error object doesn't spam.
  const lastErrorReason = useRef<string | null>(null)
  useEffect(() => {
    if (!error) {
      lastErrorReason.current = null
      return
    }
    if (lastErrorReason.current === error.reason) return
    lastErrorReason.current = error.reason
    toast.error(tErrors('title'), {
      description: tErrors(messageKey(error.kind).replace('errors.', '') as never),
    })
  }, [error, tErrors])

  if (state !== 'loading-model' && state !== 'inferring') return null

  let label: string
  let pct: number | null = null
  if (state === 'loading-model') {
    if (progress?.phase === 'download' && progress.loaded && progress.total) {
      label = tProgress('download', {
        loaded: formatBytes(progress.loaded),
        total: formatBytes(progress.total),
      })
      pct = (progress.loaded / progress.total) * 100
    } else {
      label = tProgress('init')
    }
  } else {
    label = tProgress('infer')
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-30 w-80 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {state === 'loading-model' ? tStates('loadingModel') : tStates('inferring')}
        </p>
        {backend ? (
          <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[var(--color-primary-dk)] uppercase">
            {tBackend(backend)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-divider)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-200"
          style={{
            width: pct === null ? '40%' : `${Math.max(4, Math.min(100, pct))}%`,
            // Indeterminate phases pulse softly.
            animation: pct === null ? 'pixfit-pulse 1.4s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-mute)]">{label}</p>
    </div>
  )
}

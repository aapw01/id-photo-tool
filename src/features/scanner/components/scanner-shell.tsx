'use client'

/**
 * Scanner workspace shell.
 *
 * Three-pane layout (uploads · preview · config). The page route is
 * a server component for SSR-friendly SEO; this shell mounts via
 * `dynamic({ ssr: false })` so the rectify pipeline (Web Worker +
 * canvas APIs) only runs on the client.
 *
 * Crawlers see the SEO intro + title + h1 on first byte; the
 * interactive editor mounts after hydration.
 */

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ClockFading } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { DOC_SPECS } from '../lib/doc-specs'
import { useScannerStore } from '../store'
import { ScannerConfig } from './scanner-config'
import { ScannerPreview } from './scanner-preview'
import { ScannerUploads } from './scanner-uploads'

/**
 * Read `?spec=` once on mount and preselect the matching DocSpec in
 * the scanner store. Lets SEO landing pages deep-link directly into
 * the workspace with the right doc type already chosen
 * (e.g. `/scanner?spec=us-driver-license`).
 *
 * Hydration-only — we never push back to the URL, since URL ↔ state
 * sync for every config change would create noisy navigations.
 */
function useSpecDeeplink() {
  const searchParams = useSearchParams()
  const setDocSpecId = useScannerStore((s) => s.setDocSpecId)
  const consumedRef = useRef(false)

  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true
    const raw = searchParams.get('spec')
    if (!raw) return
    const known = DOC_SPECS.find((s) => s.id === raw)
    if (!known) return
    setDocSpecId(known.id)
  }, [searchParams, setDocSpecId])
}

export function ScannerShell() {
  const t = useTranslations('Scanner.shell')
  useSpecDeeplink()

  return (
    <div className="space-y-6">
      <div
        role="status"
        className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/40 p-4"
      >
        <ClockFading
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--color-primary-dk)]"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              {t('comingSoonHeading')}
            </h2>
            <span className="rounded-full bg-[var(--color-primary-dk)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-white uppercase">
              {t('comingSoonBadge')}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-mute)]">{t('comingSoonBody')}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        <ScannerUploads />
        <ScannerPreview emptyLabel={t('previewTitle')} emptyHint={t('previewEmpty')} />
        <ScannerConfig />
      </div>
    </div>
  )
}

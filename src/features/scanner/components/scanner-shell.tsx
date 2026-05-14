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
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
      <ScannerUploads />
      <ScannerPreview emptyLabel={t('previewTitle')} emptyHint={t('previewEmpty')} />
      <ScannerConfig />
    </div>
  )
}

'use client'

/**
 * Scanner workspace shell.
 *
 * The right-rail "Coming soon" banner + the three-pane layout (uploads ·
 * preview · config) are stable as of S1. S2 swaps the upload column
 * placeholders for the real `ScannerUploads` (with drag/drop, HEIC
 * conversion, and EXIF-correct decode). S3+ will replace the preview
 * column placeholder with the live perspective-corrected preview, and
 * the config column placeholder with real spec / mode / watermark
 * controls.
 *
 * Why a "shell" component:
 *   - Keeps the page route thin and SSR-friendly (page is a server
 *     component; this shell mounts via `dynamic({ ssr: false })`).
 *   - Crawlers see the SEO intro + title + h1 on first byte; the
 *     interactive editor mounts after hydration.
 */

import { useTranslations } from 'next-intl'
import { ClockFading, FilePenLine } from 'lucide-react'

import { ScannerPreview } from './scanner-preview'
import { ScannerUploads } from './scanner-uploads'

export function ScannerShell() {
  const t = useTranslations('Scanner.shell')

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
        {/* Uploads column — drag/drop, HEIC conversion, EXIF orientation */}
        <ScannerUploads />

        {/* Preview column — rectified result via OpenCV.js (S3) */}
        <ScannerPreview emptyLabel={t('previewTitle')} emptyHint={t('previewEmpty')} />

        {/* Config column (placeholder until S4-S5) */}
        <div
          aria-label={t('configTitle')}
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <div className="flex items-center gap-2">
            <FilePenLine
              aria-hidden="true"
              className="size-4 text-[var(--color-text-mute)] opacity-70"
            />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('configTitle')}</h3>
          </div>
          <p className="text-xs text-[var(--color-text-mute)]">{t('configHint')}</p>
          <ConfigRowPlaceholder />
          <ConfigRowPlaceholder />
          <ConfigRowPlaceholder />
        </div>
      </div>
    </div>
  )
}

function ConfigRowPlaceholder() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-[var(--color-divider)]" />
      <div className="h-2 flex-1 rounded-full bg-[var(--color-divider)]/60" />
    </div>
  )
}

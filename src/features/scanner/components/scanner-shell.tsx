'use client'

/**
 * Scanner workspace skeleton (S1).
 *
 * This is a *static* placeholder UI: it sketches the three-pane layout
 * the live scanner will live in (upload zones · live preview · config
 * panel), shows a "coming soon" notice, and renders zero business
 * logic. The actual scan / copy / watermark / PDF pipeline arrives in
 * S2–S8.
 *
 * Why ship the shell now:
 *   - Locks the routing + i18n + nav surface area (the parts touching
 *     other parts of the codebase) so S2+ can be pure feature work
 *     inside this folder.
 *   - Gives crawlers a SSR-ready landing page with description copy
 *     for SEO from day one (the `/scanner` and `/scanner/[docType]`
 *     URLs need to exist before they can be indexed).
 *   - Lets us validate the lazy-mount + Vercel CPU profile end-to-end
 *     before any heavy code (OpenCV.js, jsPDF) gets pulled in.
 */

import { useTranslations } from 'next-intl'
import { ScanLine, ImageUp, FilePenLine, ClockFading } from 'lucide-react'

export function ScannerShell() {
  const t = useTranslations('Scanner.shell')

  return (
    <div className="space-y-6">
      {/* Coming-soon notice — replaced by the real workspace in S2+ */}
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

      {/* Three-pane skeleton: uploads · preview · config */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* Uploads column */}
        <div className="flex flex-col gap-4">
          <UploadZonePlaceholder
            label={t('uploadFrontTitle')}
            hint={t('uploadFrontHint')}
            icon={<ImageUp className="size-7" aria-hidden="true" />}
          />
          <UploadZonePlaceholder
            label={t('uploadBackTitle')}
            hint={t('uploadBackHint')}
            icon={<ImageUp className="size-7" aria-hidden="true" />}
          />
        </div>

        {/* Preview column */}
        <div
          aria-label={t('previewTitle')}
          className="flex aspect-[1/1.414] min-h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
        >
          <ScanLine
            aria-hidden="true"
            className="size-10 text-[var(--color-text-mute)] opacity-60"
          />
          <div className="text-sm font-medium text-[var(--color-text-mute)]">
            {t('previewTitle')}
          </div>
          <p className="max-w-xs text-xs text-[var(--color-text-mute)]/80">{t('previewEmpty')}</p>
        </div>

        {/* Config column */}
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
          {/* Disabled placeholder rows — make the eventual UI shape obvious */}
          <ConfigRowPlaceholder />
          <ConfigRowPlaceholder />
          <ConfigRowPlaceholder />
        </div>
      </div>
    </div>
  )
}

function UploadZonePlaceholder({
  label,
  hint,
  icon,
}: {
  label: string
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex aspect-[1.586/1] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
      <div className="text-[var(--color-text-mute)]/70">{icon}</div>
      <div className="text-sm font-medium text-[var(--color-text-mute)]">{label}</div>
      <div className="text-[11px] text-[var(--color-text-mute)]/70">{hint}</div>
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

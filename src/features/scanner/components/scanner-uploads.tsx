'use client'

/**
 * Composes two `ScannerUploadCard`s (front + back) into the upload
 * column of the Scanner workspace, plus the "this document has a
 * back side" toggle.
 *
 * The toggle defaults to true (id-card / driver-license) and can be
 * flipped off for single-sided documents (passport personal page,
 * birth certificate, etc.) — turning it off also clears any back
 * slot via the store so the bitmap isn't retained in memory.
 */

import { useTranslations } from 'next-intl'

import { useScannerStore } from '../store'
import { ScannerUploadCard } from './scanner-upload-card'

export function ScannerUploads() {
  const t = useTranslations('Scanner.upload')
  const front = useScannerStore((s) => s.front)
  const back = useScannerStore((s) => s.back)
  const hasBack = useScannerStore((s) => s.hasBack)
  const setFrontImage = useScannerStore((s) => s.setFrontImage)
  const setBackImage = useScannerStore((s) => s.setBackImage)
  const clearFront = useScannerStore((s) => s.clearFront)
  const clearBack = useScannerStore((s) => s.clearBack)
  const setHasBack = useScannerStore((s) => s.setHasBack)

  return (
    <div className="flex flex-col gap-4">
      <ScannerUploadCard
        slot={front}
        title={t('frontTitle')}
        hint={t('frontHint')}
        onPick={setFrontImage}
        onClear={clearFront}
      />

      {/* Toggle: does this document have a back side? */}
      <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={hasBack}
          onChange={(e) => setHasBack(e.target.checked)}
          className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        />
        <span className="flex-1">{t('hasBackToggle')}</span>
      </label>

      {hasBack && (
        <ScannerUploadCard
          slot={back}
          title={t('backTitle')}
          hint={t('backHint')}
          onPick={setBackImage}
          onClear={clearBack}
        />
      )}
    </div>
  )
}

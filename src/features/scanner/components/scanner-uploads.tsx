'use client'

/**
 * Composes two `ScannerUploadCard`s (front + back) into the upload
 * column of the Scanner workspace.
 *
 * Both cards always render. The back card is optional from the user's
 * perspective — leaving it empty is a supported flow; export packs
 * only the sides that are actually rectified. We dropped the explicit
 * "does this doc have a back?" toggle because it added a click users
 * routinely ignored and didn't change any downstream behavior.
 */

import { useTranslations } from 'next-intl'

import { useScannerStore } from '../store'
import { ScannerUploadCard } from './scanner-upload-card'

export function ScannerUploads() {
  const t = useTranslations('Scanner.upload')
  const front = useScannerStore((s) => s.front)
  const back = useScannerStore((s) => s.back)
  const setFrontImage = useScannerStore((s) => s.setFrontImage)
  const setBackImage = useScannerStore((s) => s.setBackImage)
  const clearFront = useScannerStore((s) => s.clearFront)
  const clearBack = useScannerStore((s) => s.clearBack)

  return (
    <div className="flex flex-col gap-4">
      <ScannerUploadCard
        slot={front}
        title={t('frontTitle')}
        hint={t('frontHint')}
        onPick={setFrontImage}
        onClear={clearFront}
      />
      <ScannerUploadCard
        slot={back}
        title={t('backTitle')}
        hint={t('backHint')}
        onPick={setBackImage}
        onClear={clearBack}
      />
    </div>
  )
}

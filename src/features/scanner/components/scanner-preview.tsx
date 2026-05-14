'use client'

/**
 * Scanner preview pane.
 *
 * Renders, per uploaded side:
 *   - The rectified result (blob URL) once the pipeline reaches the
 *     `ready` state.
 *   - A spinner + status message while rectification is in flight.
 *   - An error state with retry CTA if the pipeline failed.
 *
 * Also hosts the inline corner editor. Each side toggles its own
 * editor open/closed independently so the user can adjust front and
 * back without losing context.
 *
 * Download button: ships in S3 so a user with auto-detect-only needs
 * isn't blocked by S5's full PDF / watermark export. It saves the
 * rectified PNG directly via an `<a download>` click. Watermarked
 * exports overwrite this in S5.
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Edit3, Info, Loader2, Download } from 'lucide-react'

import { useScannerStore, type ScannerSlot, type ScannerSide } from '../store'
import { ScannerCornerEditor } from './scanner-corner-editor'
import type { Quad } from '../lib/detect-corners'

interface ScannerPreviewProps {
  emptyLabel: string
  emptyHint: string
}

export function ScannerPreview({ emptyLabel, emptyHint }: ScannerPreviewProps) {
  const front = useScannerStore((s) => s.front)
  const back = useScannerStore((s) => s.back)
  const hasBack = useScannerStore((s) => s.hasBack)

  if (!front && (!hasBack || !back)) {
    return <EmptyPreview emptyLabel={emptyLabel} emptyHint={emptyHint} />
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      {front && <PreviewCard side="front" slot={front} />}
      {hasBack && back && <PreviewCard side="back" slot={back} />}
    </div>
  )
}

function EmptyPreview({ emptyLabel, emptyHint }: { emptyLabel: string; emptyHint: string }) {
  return (
    <div
      aria-label={emptyLabel}
      className="flex aspect-[1/1.414] min-h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
    >
      <div className="text-sm font-medium text-[var(--color-text-mute)]">{emptyLabel}</div>
      <p className="max-w-xs text-xs text-[var(--color-text-mute)]/80">{emptyHint}</p>
    </div>
  )
}

function PreviewCard({ side, slot }: { side: ScannerSide; slot: ScannerSlot }) {
  const t = useTranslations('Scanner.preview')
  const rectifySide = useScannerStore((s) => s.rectifySide)
  const [editing, setEditing] = useState(false)
  // Prefer the mode-applied output ("rendered") when available;
  // fall back to the raw rectified blob while the post-pass runs.
  const displayBlob = slot.rendered?.blob ?? slot.rectified?.blob ?? null
  const rectifiedUrl = useBlobUrl(displayBlob)

  const label = side === 'front' ? t('frontLabel') : t('backLabel')

  const initialQuad: Quad = slot.rectified?.quad ?? {
    topLeft: { x: 0, y: 0 },
    topRight: { x: slot.bitmap.width, y: 0 },
    bottomRight: { x: slot.bitmap.width, y: slot.bitmap.height },
    bottomLeft: { x: 0, y: slot.bitmap.height },
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{label}</h3>
        <div className="flex items-center gap-1">
          {slot.rectifyState === 'ready' && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]"
            >
              <Edit3 className="size-3.5" aria-hidden="true" />
              {t('editCorners')}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <ScannerCornerEditor
          slot={slot}
          initial={initialQuad}
          onApply={async (q) => {
            setEditing(false)
            await rectifySide(side, q)
          }}
          onCancel={() => setEditing(false)}
          onResetToDetected={() => {
            setEditing(false)
            void rectifySide(side)
          }}
        />
      ) : (
        <>
          {slot.rectified && !slot.rectified.userAdjusted && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 px-3 py-2">
              <Info
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-[var(--color-primary-dk)]"
              />
              <p className="text-[11px] leading-relaxed text-[var(--color-text)]">
                {t('adjustHint')}
              </p>
            </div>
          )}
          <PreviewBody
            slot={slot}
            rectifiedUrl={rectifiedUrl}
            onRetry={() => void rectifySide(side)}
          />
        </>
      )}

      {slot.rectified && slot.rectifyState === 'ready' && (
        <DownloadRow slot={slot} rectifiedUrl={rectifiedUrl} side={side} />
      )}
    </div>
  )
}

function PreviewBody({
  slot,
  rectifiedUrl,
  onRetry,
}: {
  slot: ScannerSlot
  rectifiedUrl: string | null
  onRetry: () => void
}) {
  const t = useTranslations('Scanner.preview')

  if (slot.rectifyState === 'processing') {
    return (
      <div className="flex aspect-[1.586/1] flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-divider)]/30 p-6 text-center">
        <Loader2
          aria-hidden="true"
          className="size-7 animate-spin text-[var(--color-primary-dk)]"
        />
        <p className="text-xs text-[var(--color-text-mute)]">{t('processing')}</p>
      </div>
    )
  }

  if (slot.rectifyState === 'error') {
    return (
      <div className="flex aspect-[1.586/1] flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-divider)]/30 p-6 text-center">
        <p className="text-xs text-[var(--color-text)]">
          {t('rectifyError', { message: slot.rectifyError ?? '' })}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  if (slot.rectifyState === 'ready' && rectifiedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={rectifiedUrl}
        alt=""
        className="block h-auto w-full rounded-[var(--radius-md)] border border-[var(--color-border)]"
      />
    )
  }

  // idle (e.g. doc spec just changed; rectify will fire next tick)
  return (
    <div className="flex aspect-[1.586/1] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-divider)]/30 text-xs text-[var(--color-text-mute)]">
      {t('processing')}
    </div>
  )
}

function DownloadRow({
  slot,
  rectifiedUrl,
  side,
}: {
  slot: ScannerSlot
  rectifiedUrl: string | null
  side: ScannerSide
}) {
  const t = useTranslations('Scanner.preview')
  if (!rectifiedUrl) return null
  const baseName = slot.file.name.replace(/\.[^.]+$/, '')
  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--color-divider)]/40 px-3 py-2">
      <span className="text-[11px] text-[var(--color-text-mute)]">{t('downloadHint')}</span>
      <a
        href={rectifiedUrl}
        download={`${baseName}-scan-${side}.png`}
        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)]"
      >
        <Download className="size-3.5" aria-hidden="true" />
        {t('downloadCurrent')}
      </a>
    </div>
  )
}

function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

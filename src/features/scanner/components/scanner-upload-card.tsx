'use client'

/**
 * Single-side upload card used by the Scanner.
 *
 * One card per side (front / back). Owns three visual states:
 *
 *   1. Empty — drag-and-drop or click-to-pick.
 *   2. Busy — a small spinner overlay shown while the upload
 *      pipeline is decoding (HEIC conversion may take a few hundred
 *      ms on older phones).
 *   3. Loaded — thumbnail of the decoded blob, file name + size,
 *      remove button, and a "HEIC converted" badge when applicable.
 *
 * The card never blocks the UI thread itself — `onPick` is awaited
 * inside an effect-style handler so the parent store decides where
 * the heavy work happens.
 *
 * Aspect ratio is fixed at the ISO/IEC 7810 ID-1 aspect (1.586 : 1)
 * so an empty card already implies the document shape we expect.
 */

import { type DragEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ImageUp, Loader2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { DocumentUploadError, type LoadedDocumentImage } from '../lib/load-document-image'
import type { ScannerSlot } from '../store'

/**
 * Accept everything we can read: standard browser image MIMEs, HEIC,
 * and single-page PDFs. The `.heic` / `.heif` / `.pdf` extensions are
 * spelled out for Safari, which sometimes leaves `file.type` empty
 * for those formats.
 */
const ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif,.pdf'

interface ScannerUploadCardProps {
  slot: ScannerSlot | null
  title: string
  hint: string
  onPick: (file: File) => Promise<LoadedDocumentImage>
  onClear: () => void
  /** When true, render the disabled/placeholder appearance (no interactions). */
  disabled?: boolean
  className?: string
}

export function ScannerUploadCard({
  slot,
  title,
  hint,
  onPick,
  onClear,
  disabled,
  className,
}: ScannerUploadCardProps) {
  const t = useTranslations('Scanner.upload')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useObjectUrl(slot?.blob ?? null)

  const handlePick = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const loaded = await onPick(file)
        // Multi-page PDFs: V1 only renders page 1, but the user should
        // know we didn't silently drop pages 2+. A single-page PDF
        // (sourcePageCount === 1) flows through without a toast.
        if (
          loaded.convertedFromPdf &&
          typeof loaded.sourcePageCount === 'number' &&
          loaded.sourcePageCount > 1
        ) {
          toast.info(t('pdfMultiPageNotice', { count: loaded.sourcePageCount }))
        }
      } catch (err) {
        if (err instanceof DocumentUploadError) {
          toast.error(t(`errors.${err.code}`, { name: err.fileName ?? '' }))
        } else {
          toast.error(t('errors.unknown'))
        }
      } finally {
        setBusy(false)
      }
    },
    [onPick, t],
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      void handlePick(file)
    },
    [handlePick],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || busy) return
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (disabled || busy) return
    if (!dragging) setDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (slot || disabled || busy) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  // Empty state — dropzone.
  if (!slot) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'group relative flex aspect-[1.586/1] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed p-4 text-center transition-colors',
          dragging
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {busy ? (
          <Loader2
            aria-hidden="true"
            className="size-7 animate-spin text-[var(--color-primary-dk)]"
          />
        ) : (
          <ImageUp
            aria-hidden="true"
            className="size-7 text-[var(--color-text-mute)]/70 group-hover:text-[var(--color-primary-dk)]"
          />
        )}
        <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
        <div className="text-[11px] text-[var(--color-text-mute)]">
          {busy ? t('uploading') : hint}
        </div>
        {!busy && (
          <div className="mt-1 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white shadow-[var(--shadow-sm)] group-hover:bg-[var(--color-primary-dk)]">
            {t('browse')}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    )
  }

  // Loaded state — thumbnail + meta + remove.
  return (
    <div
      className={cn(
        'relative flex aspect-[1.586/1] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]',
        className,
      )}
    >
      {previewUrl && (
        // The preview is a transient `blob:` URL created via
        // `URL.createObjectURL` from the decoded upload — `next/image`'s
        // optimizer can't process those, so a plain <img> is correct
        // here (and avoids burning a Vercel Image Optimization
        // invocation per upload).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={t('previewAlt')}
          className="absolute inset-0 h-full w-full bg-[var(--color-divider)]/30 object-contain"
        />
      )}

      {/* Bottom info strip — file name + size + HEIC / PDF badge.
          HEIC and PDF are mutually exclusive sources, so we render at
          most one badge per slot to keep the strip uncrowded. */}
      <div className="absolute right-0 bottom-0 left-0 flex items-center gap-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pt-6 pb-2 text-white">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{slot.file.name}</div>
          <div className="text-[10px] opacity-80">{formatBytes(slot.file.size)}</div>
        </div>
        {slot.convertedFromPdf && typeof slot.sourcePageCount === 'number' ? (
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            {t('pdfBadge', { count: slot.sourcePageCount })}
          </span>
        ) : slot.convertedFromHeic ? (
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            {t('heicBadge')}
          </span>
        ) : null}
      </div>

      {/* Remove button — top-right */}
      <button
        type="button"
        onClick={onClear}
        aria-label={t('remove')}
        className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-80 transition-opacity hover:bg-black/75 hover:opacity-100"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      {/* Re-upload (covers the entire surface) — kept invisible but
          interactive so the user can drop a new file directly onto
          the preview to replace it. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}

/**
 * Manage a `URL.createObjectURL` lifetime tied to a `Blob`. Returns
 * the URL string (or `null`) and revokes the URL on cleanup so the
 * browser can release the blob.
 */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [blob])
  return url
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

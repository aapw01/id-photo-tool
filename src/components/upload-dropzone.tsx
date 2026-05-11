'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  /** Receives the selected file. T19 is UI-only; wiring to the studio comes in M2. */
  onSelect?: (file: File) => void
  accept?: string
  className?: string
}

/**
 * Visual-only upload dropzone for the M1 landing page.
 *
 * - Drag enter / leave / drop are tracked locally and reflected via classes.
 * - File selection is forwarded via `onSelect`, but no upload happens — this
 *   is intentionally inert until M2 wires it to the Studio state machine.
 */
export function UploadDropzone({
  onSelect,
  accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  className,
}: UploadDropzoneProps) {
  const t = useTranslations('Home.uploadDropzone')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      onSelect?.(file)
    },
    [onSelect],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isDragging) setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        onFiles(e.dataTransfer.files)
      }}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-2xl)] border-2 border-dashed px-8 py-14 text-center transition-colors',
        isDragging
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-dk)]">
        <Upload className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-medium text-[var(--color-text)]">{t('title')}</p>
        <p className="text-sm text-[var(--color-text-mute)]">{t('subtitle')}</p>
      </div>
      <span className="mt-1 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] group-hover:bg-[var(--color-primary-dk)]">
        {t('browse')}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  )
}

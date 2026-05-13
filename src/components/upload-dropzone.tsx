'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useRouter } from '@/i18n/navigation'
import { useStudioStore } from '@/features/studio/store'

interface UploadDropzoneProps {
  /**
   * Optional custom handler. If omitted, the dropzone stages the file
   * into the Studio store and navigates to `/studio` — the default
   * behaviour wired in M2-T16.
   */
  onSelect?: (file: File) => void
  accept?: string
  className?: string
}

/**
 * Upload dropzone shared between the landing page and the studio.
 *
 * - Drag enter / leave / drop are reflected locally via classes.
 * - When no custom `onSelect` is provided, the picked file is staged
 *   into the Studio store and the user is routed to /studio. This
 *   keeps the landing page as the canonical entry point while still
 *   letting Studio reuse the same component (with a custom handler).
 */
export function UploadDropzone({
  onSelect,
  accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  className,
}: UploadDropzoneProps) {
  const t = useTranslations('Home.uploadDropzone')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const setFile = useStudioStore((s) => s.setFile)

  const handleFile = useCallback(
    async (file: File) => {
      if (onSelect) {
        onSelect(file)
        return
      }
      try {
        await setFile(file)
        router.push('/studio')
      } catch {
        // Decode failure surfaces in the studio toast; here we just stay put.
      }
    },
    [onSelect, router, setFile],
  )

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      void handleFile(file)
    },
    [handleFile],
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
      <p className="mt-2 text-xs text-[var(--color-text-weak)]">{t('privacy')}</p>
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

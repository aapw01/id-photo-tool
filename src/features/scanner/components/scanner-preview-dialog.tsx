'use client'

/**
 * Pre-download "what your sheet will look like" preview.
 *
 * Pixfit Scanner already ships with a per-side preview pane (see
 * `scanner-preview.tsx`) that shows the rectified cards. That pane is
 * great for verifying corner detection / output mode / watermark, but
 * it does NOT show the packed sheet — the user has to download a PDF
 * just to see whether their A4 / Letter / A5 choice and rounded
 * corners land the way they expect.
 *
 * This dialog closes that gap. It opens a modal showing the exact
 * blob that `Download A4 PNG` would produce (and that the PDF path
 * wraps verbatim into a vector page) — same paper size, same
 * watermark on/off, same rounded corners, byte-for-byte. Reuse of
 * `packCurrentSides` via the store's `regeneratePreview` action is
 * load-bearing for that parity guarantee.
 *
 * UX choices:
 *   - Re-packs on open (cache-hit fast path), and re-packs on input
 *     changes while open via a 150 ms debounce — slider drags don't
 *     burn CPU.
 *   - Skeleton during pack so the dialog still feels responsive on
 *     low-end devices (300-DPI A4 = ~25 MP, packing takes ~200 ms).
 *   - Download buttons in the footer call the SAME export functions
 *     the right-rail buttons use, so the downloaded bytes are
 *     identical to the previewed bytes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, FileDown, Loader2, ScanEye } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { useScannerStore } from '../store'

/**
 * 150 ms is comfortable for slider drags — short enough to feel
 * responsive when the user pauses on a value, long enough to skip
 * intermediate frames during a drag. Tied to the spec.
 */
const PREVIEW_DEBOUNCE_MS = 150

interface ScannerPreviewDialogProps {
  /** Whether at least one side is rectified and packable. */
  canPreview: boolean
}

export function ScannerPreviewDialog({ canPreview }: ScannerPreviewDialogProps) {
  const t = useTranslations('Scanner.preview')
  const tPaper = useTranslations('Scanner.paperSizes')
  const tExport = useTranslations('Scanner.export')

  const [open, setOpen] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState<'pdf' | 'png' | null>(null)

  // Inputs that influence the packed sheet. We resubscribe at the
  // narrowest possible slice so unrelated state churn (rectify state
  // machine ticks, etc.) doesn't re-run the debounce effect.
  const paperSize = useScannerStore((s) => s.paperSize)
  const watermark = useScannerStore((s) => s.watermark)
  const cornerRadiusPx = useScannerStore((s) => s.cornerRadiusPx)
  const outputMode = useScannerStore((s) => s.outputMode)
  const docSpecId = useScannerStore((s) => s.docSpecId)
  // Track by blob identity, not the slot record — when a rectify
  // run produces a new blob the reference changes (and the signature
  // inside the store recalculates), so this effect fires too.
  const frontBlob = useScannerStore((s) => s.front?.rectified?.blob ?? null)
  const backBlob = useScannerStore((s) => s.back?.rectified?.blob ?? null)

  const preview = useScannerStore((s) => s.preview)
  const previewState = useScannerStore((s) => s.previewState)
  const previewError = useScannerStore((s) => s.previewError)
  const regeneratePreview = useScannerStore((s) => s.regeneratePreview)
  const exportPdfBlob = useScannerStore((s) => s.exportPdfBlob)
  const exportA4PngBlob = useScannerStore((s) => s.exportA4PngBlob)

  // Debounced re-pack when the dialog is open AND any input changes.
  // The store does a cache-hit short-circuit when the signature
  // matches, so even an undebounced trigger would be cheap — the
  // debounce mostly protects against slider-drag thrashing.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!open || !canPreview) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void regeneratePreview()
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [
    open,
    canPreview,
    paperSize,
    watermark,
    cornerRadiusPx,
    outputMode,
    docSpecId,
    frontBlob,
    backBlob,
    regeneratePreview,
  ])

  // On open we want IMMEDIATE feedback — skip the debounce for the
  // first pack so the spinner appears the same tick the dialog
  // mounts. This is the only place where we go around the debounce.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && canPreview) {
        void regeneratePreview()
      }
    },
    [canPreview, regeneratePreview],
  )

  const trigger = async (kind: 'pdf' | 'png') => {
    setDownloadBusy(kind)
    try {
      const blob = kind === 'pdf' ? await exportPdfBlob() : await exportA4PngBlob()
      if (!blob) {
        toast.error(tExport('noContent'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixfit-scan.${kind === 'pdf' ? 'pdf' : 'png'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(tExport(kind === 'pdf' ? 'successPdf' : 'successPng'))
    } catch (err) {
      toast.error(tExport('errorGeneric', { message: err instanceof Error ? err.message : '' }))
    } finally {
      setDownloadBusy(null)
    }
  }

  const paperLabel = tPaper(paperSize as Parameters<typeof tPaper>[0])
  const showSkeleton = previewState === 'packing' || (canPreview && !preview && open)
  const showImage = !!preview && previewState === 'ready'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!canPreview}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-divider)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanEye className="size-4" aria-hidden="true" />
          {t('trigger')}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { paper: paperLabel })}</DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto flex w-full max-w-xl items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-divider)]"
          // Portrait aspect ratio for the active paper size — keeps the
          // dialog body the right shape even while the blob is still
          // packing so the skeleton doesn't jump on swap.
          style={{ aspectRatio: paperAspectRatio(paperSize) }}
          aria-busy={showSkeleton}
        >
          {showSkeleton && (
            <div
              role="status"
              aria-label={t('loading')}
              className="flex flex-col items-center gap-2 text-[var(--color-text-mute)]"
            >
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <span className="text-xs">{t('loading')}</span>
            </div>
          )}
          {showImage && preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.objectUrl}
              alt={t('imageAlt', { paper: paperLabel })}
              className="h-full w-full object-contain"
            />
          )}
          {!canPreview && (
            <p className="px-6 text-center text-sm text-[var(--color-text-mute)]">{t('empty')}</p>
          )}
          {previewState === 'error' && (
            <p className="px-6 text-center text-sm text-[var(--color-warning,var(--color-text))]">
              {previewError ?? t('error')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={!canPreview || downloadBusy !== null}
            onClick={() => trigger('png')}
          >
            {downloadBusy === 'png' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {downloadBusy === 'png' ? tExport('preparing') : tExport('png')}
          </Button>
          <Button
            type="button"
            disabled={!canPreview || downloadBusy !== null}
            onClick={() => trigger('pdf')}
          >
            {downloadBusy === 'pdf' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="size-4" aria-hidden="true" />
            )}
            {downloadBusy === 'pdf' ? tExport('preparing') : tExport('pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Portrait aspect ratio (width / height) for the dialog's preview
 * frame. Mirrors the physical paper dimensions in `pack-a4.ts` —
 * keeping the source of truth there would mean importing the
 * `PAPER_DIMENSIONS` record for what is purely a UI hint; the
 * trade-off is a hard-coded ratio table here that needs to stay in
 * sync if a new paper size lands.
 */
function paperAspectRatio(paper: 'a4' | 'letter' | 'a5'): string {
  switch (paper) {
    case 'a4':
      return '210 / 297'
    case 'letter':
      return '215.9 / 279.4'
    case 'a5':
      return '148 / 210'
  }
}

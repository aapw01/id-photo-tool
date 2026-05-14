'use client'

/**
 * Recent-sessions panel mounted in the right rail.
 *
 * Privacy note: we deliberately persist *configuration* only — no
 * image bytes. See `lib/history-store.ts` for the reasoning. The
 * "restore" action only re-applies DocSpec + paper size + output mode
 * + watermark; the user still has to re-upload the document.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  HISTORY_MAX_ENTRIES,
  listHistory,
  removeEntry,
  type ScannerHistoryEntry,
} from '../lib/history-store'
import { useScannerStore } from '../store'

interface ScannerHistoryProps {
  /** Notifier the parent uses to bump this panel after a fresh export. */
  reloadToken: number
}

const TIME_FORMAT_BY_LOCALE: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  en: 'en-US',
}

function formatTimestamp(ts: number, locale: string): string {
  const intl = TIME_FORMAT_BY_LOCALE[locale] ?? locale
  return new Intl.DateTimeFormat(intl, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function ScannerHistory({ reloadToken }: ScannerHistoryProps) {
  const t = useTranslations('Scanner.history')
  const tDoc = useTranslations('Scanner.docSpecs')
  const tPaper = useTranslations('Scanner.paperSizes')
  const tMode = useTranslations('Scanner.mode')
  const locale = useLocale()

  const setDocSpecId = useScannerStore((s) => s.setDocSpecId)
  const setPaperSize = useScannerStore((s) => s.setPaperSize)
  const setOutputMode = useScannerStore((s) => s.setOutputMode)
  const setWatermarkText = useScannerStore((s) => s.setWatermarkText)
  const setWatermarkOpacity = useScannerStore((s) => s.setWatermarkOpacity)
  const setWatermarkDensity = useScannerStore((s) => s.setWatermarkDensity)

  const [entries, setEntries] = useState<ScannerHistoryEntry[]>([])

  const refresh = useCallback(async () => {
    const items = await listHistory()
    setEntries(items)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, reloadToken])

  const onRestore = (entry: ScannerHistoryEntry) => {
    setDocSpecId(entry.docSpecId)
    setPaperSize(entry.paperSize)
    setOutputMode(entry.outputMode)
    setWatermarkText(entry.watermark.text)
    setWatermarkOpacity(entry.watermark.opacity)
    setWatermarkDensity(entry.watermark.density)
    toast.success(t('toast.restored'))
  }

  const onRemove = async (entry: ScannerHistoryEntry) => {
    const next = await removeEntry(entry.id)
    setEntries(next)
    toast.success(t('toast.deleted'))
  }

  return (
    <section
      className="space-y-3 border-t border-[var(--color-border)] pt-4"
      aria-labelledby="scanner-history-heading"
    >
      <div className="flex items-center gap-2">
        <History
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--color-text-mute)] opacity-70"
        />
        <h3 id="scanner-history-heading" className="text-xs font-medium text-[var(--color-text)]">
          {t('title')}
        </h3>
      </div>

      {entries.length === 0 ? (
        <p className="text-[10px] text-[var(--color-text-mute)]">{t('empty')}</p>
      ) : (
        <>
          <p className="text-[10px] text-[var(--color-text-mute)]">
            {t('hint', { max: HISTORY_MAX_ENTRIES })}
          </p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--color-text)]">
                      {tDoc(entry.docSpecId as Parameters<typeof tDoc>[0])}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-mute)]">
                      {tPaper(entry.paperSize as Parameters<typeof tPaper>[0])} ·{' '}
                      {tMode(entry.outputMode as Parameters<typeof tMode>[0])}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-weak)]">
                      {formatTimestamp(entry.createdAt, locale)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onRestore(entry)}
                      aria-label={t('restoreAria', {
                        name: tDoc(entry.docSpecId as Parameters<typeof tDoc>[0]),
                      })}
                      className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRemove(entry)}
                      aria-label={t('deleteAria', {
                        name: tDoc(entry.docSpecId as Parameters<typeof tDoc>[0]),
                      })}
                      className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-mute)] transition-colors hover:bg-[var(--color-divider)] hover:text-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

'use client'

/**
 * Paper-spec edit form. Mirrors `PhotoSpecForm` minus the
 * photo-specific bits (category / region / background / file rules).
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PaperSpec } from '@/types/spec'

import { invalidFields } from './invalid-fields'

interface PaperSpecFormProps {
  initial?: PaperSpec | null
  mode: 'create' | 'edit'
  onCancel: () => void
  onSubmit: (next: PaperSpec) => void
  invalidPaths?: readonly string[]
}

function emptyDraft(): PaperSpec {
  return {
    id: '',
    builtin: false,
    name: { zh: '', 'zh-Hant': '', en: '' },
    width_mm: 100,
    height_mm: 150,
    dpi: 300,
  }
}

export function PaperSpecForm({
  initial,
  mode,
  onCancel,
  onSubmit,
  invalidPaths,
}: PaperSpecFormProps) {
  const t = useTranslations('SpecManager')
  const tFields = useTranslations('SpecManager.form.fields')

  const [draft, setDraft] = useState<PaperSpec>(() => initial ?? emptyDraft())

  // Reset the local draft when the parent swaps in a different entry
  // to edit. React 19's lint rule forbids synchronous `setState` in an
  // effect body, hence the `await null` microtask boundary.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await null
      if (cancelled) return
      setDraft(initial ?? emptyDraft())
    })()
    return () => {
      cancelled = true
    }
  }, [initial])

  const invalid = invalidFields(invalidPaths)

  const handle = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    onSubmit({
      ...draft,
      id: draft.id.trim(),
      alias: draft.alias?.trim() ? draft.alias.trim() : undefined,
    })
  }

  return (
    <form
      className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      onSubmit={handle}
    >
      <h3 className="text-base font-medium text-[var(--color-text)]">
        {mode === 'create'
          ? t('form.createTitle', { kind: t('kinds.paper') })
          : t('form.editTitle', { name: draft.name.en || draft.id })}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="paper-id">{tFields('id')}</Label>
          <Input
            id="paper-id"
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            disabled={mode === 'edit'}
            placeholder="my-paper"
            aria-invalid={invalid('id')}
            className="font-mono text-xs"
          />
          <p className="text-xs text-[var(--color-text-weak)]">{tFields('idHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paper-alias">{tFields('alias')}</Label>
          <Input
            id="paper-alias"
            value={draft.alias ?? ''}
            onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="paper-name-zh">{tFields('nameZh')}</Label>
          <Input
            id="paper-name-zh"
            value={draft.name.zh}
            onChange={(e) => setDraft({ ...draft, name: { ...draft.name, zh: e.target.value } })}
            aria-invalid={invalid('name.zh')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paper-name-zh-hant">{tFields('nameZhHant')}</Label>
          <Input
            id="paper-name-zh-hant"
            value={draft.name['zh-Hant']}
            onChange={(e) =>
              setDraft({ ...draft, name: { ...draft.name, 'zh-Hant': e.target.value } })
            }
            aria-invalid={invalid('name.zh-Hant')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paper-name-en">{tFields('nameEn')}</Label>
          <Input
            id="paper-name-en"
            value={draft.name.en}
            onChange={(e) => setDraft({ ...draft, name: { ...draft.name, en: e.target.value } })}
            aria-invalid={invalid('name.en')}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="paper-w">{tFields('widthMm')}</Label>
          <Input
            id="paper-w"
            type="number"
            min={1}
            step={0.1}
            value={draft.width_mm}
            onChange={(e) => setDraft({ ...draft, width_mm: Number(e.target.value) })}
            aria-invalid={invalid('width_mm')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paper-h">{tFields('heightMm')}</Label>
          <Input
            id="paper-h"
            type="number"
            min={1}
            step={0.1}
            value={draft.height_mm}
            onChange={(e) => setDraft({ ...draft, height_mm: Number(e.target.value) })}
            aria-invalid={invalid('height_mm')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paper-dpi">{tFields('dpi')}</Label>
          <Input
            id="paper-dpi"
            type="number"
            min={72}
            step={1}
            value={draft.dpi}
            onChange={(e) => setDraft({ ...draft, dpi: Number(e.target.value) })}
            aria-invalid={invalid('dpi')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit">{t('form.save')}</Button>
      </div>
    </form>
  )
}

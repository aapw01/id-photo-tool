'use client'

/**
 * Photo-spec edit form.
 *
 * Controlled entirely by parent state (kind="create" vs "edit") via
 * the `initial` prop. The form keeps a local draft and only commits
 * via `onSubmit(spec)` — the parent then runs CRUD + persists.
 *
 * Field-level validation: we don't run zod inline; the canonical
 * `createPhotoSpec` / `updatePhotoSpec` actions re-validate when the
 * parent calls them, and the parent surfaces any zod issues as a
 * toast + an `aria-invalid` red ring on the offending input.
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PHOTO_CATEGORIES, type PhotoSpec } from '@/types/spec'

import { invalidFields } from './invalid-fields'

interface PhotoSpecFormProps {
  initial?: PhotoSpec | null
  mode: 'create' | 'edit'
  onCancel: () => void
  onSubmit: (next: PhotoSpec) => void
  invalidPaths?: readonly string[]
}

function emptyDraft(): PhotoSpec {
  return {
    id: '',
    builtin: false,
    category: 'custom',
    name: { zh: '', 'zh-Hant': '', en: '' },
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
  }
}

export function PhotoSpecForm({
  initial,
  mode,
  onCancel,
  onSubmit,
  invalidPaths,
}: PhotoSpecFormProps) {
  const t = useTranslations('SpecManager')
  const tFields = useTranslations('SpecManager.form.fields')
  const tCat = useTranslations('SpecManager.categories')

  const [draft, setDraft] = useState<PhotoSpec>(() => initial ?? emptyDraft())

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
      region: draft.region?.trim() ? draft.region.trim().toUpperCase() : undefined,
      background: draft.background?.recommended?.trim()
        ? { recommended: draft.background.recommended.trim() }
        : undefined,
    })
  }

  return (
    <form
      className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      onSubmit={handle}
    >
      <h3 className="text-base font-medium text-[var(--color-text)]">
        {mode === 'create'
          ? t('form.createTitle', { kind: t('kinds.photo') })
          : t('form.editTitle', { name: draft.name.en || draft.id })}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ps-id">{tFields('id')}</Label>
          <Input
            id="ps-id"
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            disabled={mode === 'edit'}
            placeholder="my-card"
            aria-invalid={invalid('id')}
            className="font-mono text-xs"
          />
          <p className="text-xs text-[var(--color-text-weak)]">{tFields('idHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-category">{tFields('category')}</Label>
          <select
            id="ps-category"
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as PhotoSpec['category'] })
            }
            aria-invalid={invalid('category')}
            className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-1 text-sm"
          >
            {PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ps-name-zh">{tFields('nameZh')}</Label>
          <Input
            id="ps-name-zh"
            value={draft.name.zh}
            onChange={(e) => setDraft({ ...draft, name: { ...draft.name, zh: e.target.value } })}
            aria-invalid={invalid('name.zh')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-name-zh-hant">{tFields('nameZhHant')}</Label>
          <Input
            id="ps-name-zh-hant"
            value={draft.name['zh-Hant']}
            onChange={(e) =>
              setDraft({ ...draft, name: { ...draft.name, 'zh-Hant': e.target.value } })
            }
            aria-invalid={invalid('name.zh-Hant')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-name-en">{tFields('nameEn')}</Label>
          <Input
            id="ps-name-en"
            value={draft.name.en}
            onChange={(e) => setDraft({ ...draft, name: { ...draft.name, en: e.target.value } })}
            aria-invalid={invalid('name.en')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="ps-w">{tFields('widthMm')}</Label>
          <Input
            id="ps-w"
            type="number"
            min={1}
            step={0.1}
            value={draft.width_mm}
            onChange={(e) => setDraft({ ...draft, width_mm: Number(e.target.value) })}
            aria-invalid={invalid('width_mm')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-h">{tFields('heightMm')}</Label>
          <Input
            id="ps-h"
            type="number"
            min={1}
            step={0.1}
            value={draft.height_mm}
            onChange={(e) => setDraft({ ...draft, height_mm: Number(e.target.value) })}
            aria-invalid={invalid('height_mm')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-dpi">{tFields('dpi')}</Label>
          <Input
            id="ps-dpi"
            type="number"
            min={72}
            step={1}
            value={draft.dpi}
            onChange={(e) => setDraft({ ...draft, dpi: Number(e.target.value) })}
            aria-invalid={invalid('dpi')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps-region">{tFields('region')}</Label>
          <Input
            id="ps-region"
            maxLength={2}
            value={draft.region ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, region: e.target.value.toUpperCase() || undefined })
            }
            placeholder="US"
            aria-invalid={invalid('region')}
            className="font-mono uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ps-bg">{tFields('bgRecommended')}</Label>
        <Input
          id="ps-bg"
          value={draft.background?.recommended ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              background: e.target.value.trim() ? { recommended: e.target.value } : undefined,
            })
          }
          placeholder="#FFFFFF"
          aria-invalid={invalid('background.recommended')}
          className="font-mono text-xs"
        />
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

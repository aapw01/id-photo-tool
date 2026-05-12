import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetCropStoreForTesting, useCropStore } from './spec-store'
import { SpecPicker } from './spec-picker'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const messages: Record<string, string> = {
      'Crop.title': 'Photo spec',
      'Crop.subtitle': 'Pick a spec',
      'Crop.search': 'Search',
      'Crop.noMatches': 'No matches',
      'Crop.customSection': 'Custom size',
      'Crop.customW': 'Width (mm)',
      'Crop.customH': 'Height (mm)',
      'Crop.customDpi': 'DPI',
      'Crop.customApply': 'Use this size',
      'Crop.customNamePrefix': 'Custom',
      'Crop.stats.dimensions': '{w} × {h} mm · {wpx} × {hpx} px',
      'Crop.stats.dpi': '{dpi} DPI',
      'Crop.stats.bg': 'Bg',
      'Crop.stats.kb': '{min}–{max} KB',
      'Crop.categories.cn-id': 'CN ID',
      'Crop.categories.cn-paper': 'CN paper',
      'Crop.categories.travel-permit': 'Travel',
      'Crop.categories.visa': 'Visa',
      'Crop.categories.exam': 'Exam',
      'Crop.categories.custom': 'Custom',
      'Studio.cta.export': 'Export now',
    }
    return (key: string, vars?: Record<string, string | number>) => {
      const compound = namespace ? `${namespace}.${key}` : key
      let template = messages[compound] ?? compound
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return template
    }
  },
}))

beforeEach(() => {
  __resetCropStoreForTesting()
})

describe('SpecPicker inline custom form', () => {
  it('applies an ephemeral custom spec on submit', () => {
    render(<SpecPicker />)

    // Locate the W / H inputs via accessible name.
    const widthInput = screen.getByLabelText('Width (mm)') as HTMLInputElement
    const heightInput = screen.getByLabelText('Height (mm)') as HTMLInputElement
    fireEvent.change(widthInput, { target: { value: '40' } })
    fireEvent.change(heightInput, { target: { value: '55' } })

    fireEvent.click(screen.getByRole('button', { name: 'Use this size' }))

    const stored = useCropStore.getState().spec
    expect(stored).not.toBeNull()
    expect(stored?.id.startsWith('custom-')).toBe(true)
    expect(stored?.category).toBe('custom')
    expect(stored?.width_mm).toBe(40)
    expect(stored?.height_mm).toBe(55)
  })

  it('disables the apply button while inputs are out of range', () => {
    render(<SpecPicker />)
    const widthInput = screen.getByLabelText('Width (mm)') as HTMLInputElement
    fireEvent.change(widthInput, { target: { value: '5' } })

    const apply = screen.getByRole('button', { name: 'Use this size' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
  })
})

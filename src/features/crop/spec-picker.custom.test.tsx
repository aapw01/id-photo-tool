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
      'Crop.customUnit': 'Unit',
      'Crop.customW': 'Width ({unit})',
      'Crop.customH': 'Height ({unit})',
      'Crop.customDpi': 'DPI',
      'Crop.customDpiPxHint': 'DPI is fixed.',
      'Crop.customRangeHint': 'Range: {min}–{max} {unit}',
      'Crop.customApply': 'Use this size',
      'Crop.customNamePrefix': 'Custom',
      'Crop.units.mm': 'mm',
      'Crop.units.cm': 'cm',
      'Crop.units.inch': 'inch',
      'Crop.units.px': 'px',
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
  it('applies an ephemeral mm custom spec on submit', () => {
    render(<SpecPicker />)

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
    fireEvent.change(widthInput, { target: { value: '1' } })

    const apply = screen.getByRole('button', { name: 'Use this size' }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
  })
})

describe('SpecPicker inline custom form — units', () => {
  it('converts 2×2 inch into width_mm ≈ 50.8 mm', () => {
    render(<SpecPicker />)

    const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'inch' } })

    const widthInput = screen.getByLabelText('Width (inch)') as HTMLInputElement
    const heightInput = screen.getByLabelText('Height (inch)') as HTMLInputElement
    fireEvent.change(widthInput, { target: { value: '2' } })
    fireEvent.change(heightInput, { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Use this size' }))

    const stored = useCropStore.getState().spec
    expect(stored).not.toBeNull()
    expect(stored?.width_mm).toBeCloseTo(50.8, 5)
    expect(stored?.height_mm).toBeCloseTo(50.8, 5)
  })

  it('converts 600×600 px (DPI 300) into width_mm ≈ 50.8 mm', () => {
    render(<SpecPicker />)

    const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'px' } })

    const widthInput = screen.getByLabelText('Width (px)') as HTMLInputElement
    const heightInput = screen.getByLabelText('Height (px)') as HTMLInputElement
    fireEvent.change(widthInput, { target: { value: '600' } })
    fireEvent.change(heightInput, { target: { value: '600' } })

    fireEvent.click(screen.getByRole('button', { name: 'Use this size' }))

    const stored = useCropStore.getState().spec
    expect(stored).not.toBeNull()
    // 600 px at 300 DPI = 2 in = 50.8 mm.
    expect(stored?.width_mm).toBeCloseTo(50.8, 5)
    expect(stored?.height_mm).toBeCloseTo(50.8, 5)
    expect(stored?.dpi).toBe(300)
  })

  it('disables the DPI select when the unit is px', () => {
    render(<SpecPicker />)
    const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'px' } })

    const dpiSelect = screen.getByLabelText('DPI') as HTMLSelectElement
    expect(dpiSelect.disabled).toBe(true)
  })

  it('converts 3.5×4.9 cm into width_mm = 35 mm', () => {
    render(<SpecPicker />)
    const unitSelect = screen.getByLabelText('Unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'cm' } })

    const widthInput = screen.getByLabelText('Width (cm)') as HTMLInputElement
    const heightInput = screen.getByLabelText('Height (cm)') as HTMLInputElement
    fireEvent.change(widthInput, { target: { value: '3.5' } })
    fireEvent.change(heightInput, { target: { value: '4.9' } })

    fireEvent.click(screen.getByRole('button', { name: 'Use this size' }))

    const stored = useCropStore.getState().spec
    expect(stored?.width_mm).toBeCloseTo(35, 5)
    expect(stored?.height_mm).toBeCloseTo(49, 5)
  })
})

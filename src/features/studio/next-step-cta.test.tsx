import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NextStepCTA } from './next-step-cta'
import { useStudioTabStore } from './studio-tab-store'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const messages: Record<string, string> = {
      'Studio.nextStep.toSize': 'Next: Size',
      'Studio.nextStep.toLayout': 'Next: Layout',
      'Studio.nextStep.toExport': 'Next: Export',
    }
    return (key: string) => messages[namespace ? `${namespace}.${key}` : key] ?? key
  },
}))

const originalScrollTo = window.scrollTo

beforeEach(() => {
  useStudioTabStore.setState({
    tab: 'background',
    visited: new Set(['background']),
  })
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

afterEach(() => {
  window.scrollTo = originalScrollTo
})

describe('NextStepCTA', () => {
  it('renders the next-tab label for the background panel', () => {
    render(<NextStepCTA current="background" />)
    expect(screen.getByRole('button', { name: /Next: Size/ })).toBeInTheDocument()
  })

  it('renders the next-tab label for the size panel', () => {
    render(<NextStepCTA current="size" />)
    expect(screen.getByRole('button', { name: /Next: Layout/ })).toBeInTheDocument()
  })

  it('renders the next-tab label for the layout panel', () => {
    render(<NextStepCTA current="layout" />)
    expect(screen.getByRole('button', { name: /Next: Export/ })).toBeInTheDocument()
  })

  it('advances the studio tab store on click — background → size', () => {
    render(<NextStepCTA current="background" />)
    fireEvent.click(screen.getByRole('button', { name: /Next: Size/ }))
    expect(useStudioTabStore.getState().tab).toBe('size')
    expect(useStudioTabStore.getState().visited.has('size')).toBe(true)
  })

  it('advances the studio tab store on click — size → layout', () => {
    useStudioTabStore.setState({
      tab: 'size',
      visited: new Set(['background', 'size']),
    })
    render(<NextStepCTA current="size" />)
    fireEvent.click(screen.getByRole('button', { name: /Next: Layout/ }))
    expect(useStudioTabStore.getState().tab).toBe('layout')
  })

  it('advances the studio tab store on click — layout → export', () => {
    useStudioTabStore.setState({
      tab: 'layout',
      visited: new Set(['background', 'size', 'layout']),
    })
    render(<NextStepCTA current="layout" />)
    fireEvent.click(screen.getByRole('button', { name: /Next: Export/ }))
    expect(useStudioTabStore.getState().tab).toBe('export')
  })

  it('scrolls the document to top after switching tabs', () => {
    render(<NextStepCTA current="background" />)
    fireEvent.click(screen.getByRole('button', { name: /Next: Size/ }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Breadcrumb } from './breadcrumb'

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: { pathname: string }
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href.pathname} className={className} data-testid="locale-link">
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('<Breadcrumb />', () => {
  it('returns null when there is only one item (no trail to show)', () => {
    const { container } = render(<Breadcrumb items={[{ path: '/', name: 'Home' }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a nav with aria-label and an ordered list', () => {
    render(
      <Breadcrumb
        items={[
          { path: '/', name: 'Home' },
          { path: '/sizes', name: 'Sizes' },
        ]}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeTruthy()
    expect(nav.querySelector('ol')).toBeTruthy()
  })

  it('renders every non-final crumb as a locale-aware Link', () => {
    render(
      <Breadcrumb
        items={[
          { path: '/', name: 'Home' },
          { path: '/sizes', name: 'Sizes' },
          { path: '/sizes/us-visa', name: 'US visa' },
        ]}
      />,
    )
    const links = screen.getAllByTestId('locale-link')
    expect(links).toHaveLength(2)
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/sizes'])
  })

  it('marks the last item with aria-current="page" and does not link to it', () => {
    render(
      <Breadcrumb
        items={[
          { path: '/', name: 'Home' },
          { path: '/scanner', name: 'Scanner' },
          { path: '/scanner/us-visa', name: 'US visa' },
        ]}
      />,
    )
    const current = screen.getByText('US visa')
    expect(current.getAttribute('aria-current')).toBe('page')
    // The current page name is not inside the locale-aware Link mock.
    const links = screen.getAllByTestId('locale-link')
    for (const link of links) {
      expect(link.textContent).not.toBe('US visa')
    }
  })

  it('supports overriding the aria-label (e.g. for localized labels)', () => {
    render(
      <Breadcrumb
        ariaLabel="面包屑"
        items={[
          { path: '/', name: 'Home' },
          { path: '/scanner', name: 'Scanner' },
        ]}
      />,
    )
    expect(screen.getByRole('navigation', { name: '面包屑' })).toBeTruthy()
  })
})

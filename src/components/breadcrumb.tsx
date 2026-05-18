import { ChevronRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import type { BreadcrumbItem } from '@/lib/seo/breadcrumbs'
import { cn } from '@/lib/utils'

/**
 * Visible breadcrumb trail rendered above the page H1. Reads the
 * same `BreadcrumbItem[]` that the page's JSON-LD `BreadcrumbList`
 * serialises — single source of truth for label text + ordering.
 *
 * Markup:
 *   - `<nav aria-label="Breadcrumb"><ol>`  per WAI-ARIA breadcrumbs
 *     authoring practices.
 *   - Every non-final crumb is a locale-aware `Link`.
 *   - The final crumb carries `aria-current="page"` and is rendered
 *     as plain text (no link to self).
 *   - Hidden `<ChevronRight>` separators between siblings, hidden
 *     from the accessibility tree (`aria-hidden`).
 */
export function Breadcrumb({
  items,
  ariaLabel = 'Breadcrumb',
  className,
}: {
  items: BreadcrumbItem[]
  ariaLabel?: string
  className?: string
}) {
  if (items.length <= 1) return null
  return (
    <nav aria-label={ariaLabel} className={cn('w-full', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-weak)]">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.path}-${idx}`} className="inline-flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="font-medium text-[var(--color-text)]">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={{ pathname: item.path }} className="hover:text-[var(--color-text)]">
                    {item.name}
                  </Link>
                  <ChevronRight
                    className="size-3.5 text-[var(--color-text-weak)]"
                    aria-hidden="true"
                  />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

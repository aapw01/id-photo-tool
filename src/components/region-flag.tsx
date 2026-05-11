import 'flag-icons/css/flag-icons.min.css'
import { cn } from '@/lib/utils'

export interface RegionFlagProps {
  /** Two-letter ISO 3166-1 alpha-2 country code (lowercase preferred, but case-insensitive). */
  countryCode: string
  /** Accessible label, e.g. "United States". Required for screen readers. */
  label: string
  className?: string
  /** Force the 4:3 aspect ratio variant. Defaults to true (matches DESIGN.md §4). */
  squared?: boolean
}

/**
 * Country flag rendered via `flag-icons` (SVG). Strictly no emoji.
 * See docs/DESIGN.md §4 for the rationale.
 */
export function RegionFlag({ countryCode, label, className, squared = false }: RegionFlagProps) {
  const code = countryCode.toLowerCase()
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'fi',
        `fi-${code}`,
        squared && 'fis',
        'inline-block overflow-hidden rounded-[2px] align-middle',
        className,
      )}
    />
  )
}

import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconClassName?: string
  /** Hide the wordmark, useful for compact headers / favicons. */
  iconOnly?: boolean
}

/**
 * Pixfit logo — a small "P" mark inscribed in a portrait-cropped frame,
 * suggesting "photo cropped to spec". Rendered as inline SVG (no asset file).
 *
 * Brand color is read from CSS var `--color-primary` so it always tracks
 * the active design token (see docs/DESIGN.md §3.1).
 */
export function Logo({ className, iconClassName, iconOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
        className={cn('size-7 shrink-0 text-[var(--color-primary)]', iconClassName)}
      >
        <rect x="2.5" y="2.5" width="27" height="27" rx="6" fill="currentColor" />
        <path
          d="M11.5 23V9.5h5.25c2.9 0 4.75 1.85 4.75 4.6 0 2.8-1.85 4.65-4.85 4.65H14.5V23h-3Zm3-6.95h2.05c1.4 0 2.25-.8 2.25-2.05 0-1.2-.85-1.95-2.25-1.95H14.5v4Z"
          fill="white"
        />
      </svg>
      {!iconOnly ? (
        <span className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Pixfit
        </span>
      ) : null}
    </span>
  )
}

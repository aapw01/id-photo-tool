import type { ReactNode } from 'react'

interface LegalSection {
  id: string
  title: string
  body: string
}

interface LegalPageProps {
  heading: string
  subtitle: string
  /**
   * Already-localised "Last updated · 2026-05-12" line. The caller
   * is responsible for resolving the ICU template, so this component
   * never has to know about message formatting.
   */
  lastUpdated: string
  sections: LegalSection[]
  /** Optional CTAs rendered above the sections. */
  actions?: ReactNode
}

/**
 * Shared layout used by `/privacy` and `/terms`. The page-level
 * `page.tsx` files own the i18n lookup and pass already-localised
 * strings here.
 */
export function LegalPage({ heading, subtitle, lastUpdated, sections, actions }: LegalPageProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 pt-10 pb-16">
      <header className="mb-10">
        <h1
          className="font-semibold tracking-tight text-balance text-[var(--color-text)]"
          style={{
            fontSize: 'var(--text-display-2)',
            lineHeight: 'var(--text-display-2--line-height)',
          }}
        >
          {heading}
        </h1>
        <p className="mt-3 text-[var(--color-text-mute)] text-[var(--text-body-lg)]">{subtitle}</p>
        <p className="mt-4 font-mono text-xs text-[var(--color-text-weak)]">{lastUpdated}</p>
        {actions ? <div className="mt-6">{actions}</div> : null}
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`section-${section.id}`}>
            <h2
              id={`section-${section.id}`}
              className="mb-2 font-semibold text-[var(--color-text)]"
              style={{
                fontSize: 'var(--text-h3)',
                lineHeight: 'var(--text-h3--line-height)',
              }}
            >
              {section.title}
            </h2>
            <p className="leading-relaxed text-[var(--color-text-mute)]">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  )
}

import { notFound } from 'next/navigation'

const isDev = process.env.NODE_ENV !== 'production'

type Swatch = {
  name: string
  varName: string
  hex: string
  note?: string
}

const brand: Swatch[] = [
  { name: 'Primary', varName: '--color-primary', hex: '#10B981' },
  { name: 'Primary Dark', varName: '--color-primary-dk', hex: '#059669' },
  { name: 'Primary Soft', varName: '--color-primary-soft', hex: '#D1FAE5' },
  { name: 'Accent', varName: '--color-accent', hex: '#F59E0B' },
]

const neutrals: Swatch[] = [
  { name: 'Background', varName: '--color-bg', hex: '#FAFAF9' },
  { name: 'Surface', varName: '--color-surface', hex: '#FFFFFF' },
  { name: 'Text', varName: '--color-text', hex: '#1C1917' },
  { name: 'Text Mute', varName: '--color-text-mute', hex: '#57534E' },
  { name: 'Text Weak', varName: '--color-text-weak', hex: '#A8A29E' },
  { name: 'Border', varName: '--color-border', hex: '#E7E5E4' },
  { name: 'Divider', varName: '--color-divider', hex: '#F5F5F4' },
]

const semantic: Swatch[] = [
  { name: 'Success', varName: '--color-success', hex: '#10B981' },
  { name: 'Warning', varName: '--color-warning', hex: '#F59E0B' },
  { name: 'Danger', varName: '--color-danger', hex: '#EF4444' },
  { name: 'Info', varName: '--color-info', hex: '#0EA5E9' },
]

const typeRamp = [
  { label: 'Display 1', className: 'text-display-1', cssVar: '--text-display-1', sample: 'Pixfit' },
  { label: 'Display 2', className: 'text-display-2', cssVar: '--text-display-2', sample: '像配' },
  { label: 'H1', className: 'text-h1', cssVar: '--text-h1', sample: '一站式证件照工作台' },
  { label: 'H2', className: 'text-h2', cssVar: '--text-h2', sample: '换底色 · 裁剪 · 排版' },
  { label: 'H3', className: 'text-h3', cssVar: '--text-h3', sample: '隐私优先，照片不离开设备' },
  {
    label: 'Body Lg',
    className: 'text-body-lg',
    cssVar: '--text-body-lg',
    sample: '上传一张人像，即可智能换底色与裁剪。',
  },
  {
    label: 'Body',
    className: 'text-body',
    cssVar: '--text-body',
    sample: '我们在浏览器内完成全部处理。',
  },
  {
    label: 'Body Sm',
    className: 'text-body-sm',
    cssVar: '--text-body-sm',
    sample: '辅助说明文字与表单帮助。',
  },
  {
    label: 'Caption',
    className: 'text-caption',
    cssVar: '--text-caption',
    sample: 'CAPTION · 12px',
  },
]

const radii = ['sm', 'md', 'lg', 'xl', '2xl'] as const

const shadows = [
  { name: 'shadow-sm', cls: 'shadow-sm' },
  { name: 'shadow-md', cls: 'shadow-md' },
  { name: 'shadow-lg', cls: 'shadow-lg' },
]

function SwatchCard({ swatch }: { swatch: Swatch }) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div
        className="size-14 rounded-[var(--radius-md)] border border-[var(--color-border)]"
        style={{ backgroundColor: `var(${swatch.varName})` }}
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[var(--color-text)]">{swatch.name}</div>
        <div className="font-mono text-[var(--color-text-mute)] text-[var(--text-caption)]">
          {swatch.varName}
        </div>
        <div className="font-mono text-[var(--color-text-weak)] text-[var(--text-caption)]">
          {swatch.hex}
        </div>
      </div>
    </div>
  )
}

export default function DesignTokensPage() {
  if (!isDev) notFound()

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
      <header className="space-y-3">
        <p className="font-mono tracking-wider text-[var(--color-text-mute)] text-[var(--text-caption)] uppercase">
          /dev/design-tokens · 仅开发环境可见
        </p>
        <h1
          style={{
            fontSize: 'var(--text-display-2)',
            lineHeight: 'var(--text-display-2--line-height)',
          }}
          className="font-semibold tracking-tight"
        >
          Pixfit · 设计 Token 校对
        </h1>
        <p className="max-w-prose text-[var(--color-text-mute)] text-[var(--text-body-lg)]">
          这是一张用于跨设备核对色彩、字体、圆角、阴影、字重的对照表，对应{' '}
          <a className="underline" href="https://github.com/pixfit/pixfit/blob/main/docs/DESIGN.md">
            docs/DESIGN.md §3
          </a>{' '}
          的设计语言。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">品牌色 · Emerald</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {brand.map((s) => (
            <SwatchCard key={s.varName} swatch={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">中性色 · Stone</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {neutrals.map((s) => (
            <SwatchCard key={s.varName} swatch={s} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">语义色</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {semantic.map((s) => (
            <SwatchCard key={s.varName} swatch={s} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-semibold text-[var(--text-h2)]">字体层级</h2>
        <div className="space-y-4">
          {typeRamp.map((t) => (
            <div
              key={t.label}
              className="flex items-baseline justify-between gap-6 border-b border-[var(--color-divider)] pb-4"
            >
              <div
                style={{
                  fontSize: `var(${t.cssVar})`,
                  lineHeight: `var(${t.cssVar}--line-height)`,
                }}
                className="flex-1 font-medium text-[var(--color-text)]"
              >
                {t.sample}
              </div>
              <div className="shrink-0 text-right font-mono text-[var(--color-text-mute)] text-[var(--text-caption)]">
                <div>{t.label}</div>
                <div className="text-[var(--color-text-weak)]">{t.cssVar}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">圆角</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {radii.map((r) => (
            <div
              key={r}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div
                className="size-16 border border-[var(--color-border)] bg-[var(--color-primary-soft)]"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <div className="font-mono text-[var(--color-text-mute)] text-[var(--text-caption)]">
                radius-{r}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">阴影</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {shadows.map((s) => (
            <div
              key={s.name}
              className={`flex h-28 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface)] font-mono text-[var(--color-text-mute)] text-[var(--text-caption)] ${s.cls}`}
            >
              {s.name}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-[var(--text-h2)]">焦点态</h2>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)]">
            Tab focus me
          </button>
          <a
            href="#"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)]"
          >
            Or focus me
          </a>
        </div>
      </section>
    </main>
  )
}

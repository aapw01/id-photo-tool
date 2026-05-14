# Pixfit · 像配

> The one-stop, in-browser ID-photo workbench — swap backgrounds, crop, lay out, compress, export. Your photos never leave your device.

[![CI](https://github.com/aapw01/id-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/aapw01/id-photo-tool/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-pix--fit.com-10b981.svg)](https://pix-fit.com)

Languages: **English** · [中文](README.zh-CN.md)

Live demo: <https://pix-fit.com>

## Features

- **No backend, no login** — Cutout, compositing, compression, and export all run in the browser; your photo is never uploaded anywhere.
- **AI background removal + replacement** — In-browser MODNet inference produces a hair-level alpha matte with spill suppression; presets for white / blue / red / light gray plus any custom color.
- **28 built-in photo specs** — China ID / passport / 1-inch / 2-inch, US / UK / Schengen / Japan / Korea / Canada / Australia / Singapore / Russia / India / Malaysia / Vietnam / Thailand / HK-Macau / Taiwan permits, plus Guokao / NCRE / postgrad exam registration.
- **Composition-aware alignment** — Head position is auto-calibrated from MediaPipe landmarks + MODNet mask so the eye line and head-to-frame ratio fall within each spec's window.
- **Multi-format export** — PNG (transparent / flat), JPG, WebP; compress to a target KB (binary search + pixel downsample); one-click copy to clipboard.
- **Print layout** — 7 paper stocks × 12 layout templates so you can print multiple photos in a single sheet.
- **Three-locale SEO** — `zh-Hans` / `zh-Hant` / `en` with full hreflang × canonical × JSON-LD (`WebApplication` / `WebSite` / `HowTo` / `FAQPage` / `BreadcrumbList`); each of the 28 specs has its own SSG landing page.

## Pixfit Scanner · Document Scan Generator

Sub-product at `/[locale]/scanner`. Turns phone snapshots of documents into "real scanner"-grade PDF / PNG sheets — production-ready.

- **Perspective rectification** — A hand-ported `getPerspectiveTransform` + `warpPerspective` (8×8 Gaussian elimination, 4-tap bilinear, BORDER_REPLICATE) runs in a dedicated Web Worker — no OpenCV, near-zero bundle cost. The default crop is a center fit matched to the doc spec; the inline corner editor lets you drag the four handles to the document's actual edges.
- **Three output modes** — Scan (color + auto white balance) / Copy (B&W binarize) / Enhance (saturation + contrast). Mode switches re-render from the rectified result without re-detecting corners.
- **Optional watermark** — Off by default. When you turn it on, a 45° tiled overlay with your text, opacity, and density is applied as a single layer on the full A4 / Letter sheet at export time (per-side previews show the watermark too).
- **Optional rounded corners** — Slider 0–80 px (off by default); applied identically across per-side preview, single-side PNG, and the packed sheet.
- **Sheet preview dialog** — A "Preview sheet" button next to the export buttons opens a Radix dialog that renders the packed A4 / Letter / A5 sheet with the exact bytes you'd download (same paper, watermark, corner radius, output mode).
- **12 DocSpecs, 3 paper sizes** — China / HK / TW / SG / IN ID cards, bank card, US driver license, China driver / vehicle license booklets, passport bio page, plus full-size A4 / Letter. Pack to A4 / Letter / A5.
- **PDF / HEIC / EXIF / large-file pre-compression** — `.pdf` uploads render the first page lazily via `pdfjs-dist`; HEIC auto-converts via `heic2any`; EXIF orientation is auto-applied; images > 4000 px on the long edge are pre-downsampled to keep things snappy.
- **SEO landing pages** — 12 DocSpecs × 3 locales = 36 SSG pages (`/[locale]/scanner/[docType]`), each with `HowTo` / `FAQPage` / `BreadcrumbList` JSON-LD; all 36 URLs in the sitemap with full hreflang alternates.
- **Privacy & legal copy** — The home page explains local-only processing and lawful use; the Terms page forbids forgery / impersonation.
- **a11y** — All form controls have labels, all buttons have aria-labels, and the sheet-preview dialog uses Radix Dialog for focus trap, ESC-to-close, and click-outside-to-close.

## Docs

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Technical architecture: [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md)
- Project plan: [docs/PLAN.md](docs/PLAN.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)
- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Task records: [docs/tasks/](docs/tasks/)

## Local development

Requirements:

- Node.js 22.13+ (we recommend `nvm`; there's a `.nvmrc` at the repo root)
- pnpm 11+

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Common scripts

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm start          # production server
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm format         # Prettier write
pnpm test           # vitest run
pnpm i18n:check     # verify three-locale key parity
pnpm models:fetch   # fetch the MODNet ONNX model into public/_models/
pnpm cf:build       # bundle for Cloudflare Workers via OpenNext
pnpm cf:deploy      # build + deploy to Cloudflare Workers
```

## Deployment

The repo supports **both** production deployments simultaneously — they don't conflict:

| Platform               | Config           | Trigger                          | Use case                                                                   |
| ---------------------- | ---------------- | -------------------------------- | -------------------------------------------------------------------------- |
| **Cloudflare Workers** | `wrangler.jsonc` | CF Dashboard Git integration     | Best for users in Mainland China; low traffic (Free-tier CPU limits apply) |
| **Vercel**             | `vercel.json`    | Vercel Dashboard Git integration | Best for overseas users; no CPU limit; Hobby plan is more than enough      |

Both pipelines run `pnpm models:fetch` first to drop MODNet into `public/_models/`; the script is idempotent — it won't re-download an existing file. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for switch / rollback steps.

## Model asset

Background removal uses the open-source [`Xenova/modnet`](https://huggingface.co/Xenova/modnet) model (Apache-2.0). We **do not** commit `.onnx` files to git. First-time setup or CI:

```bash
pnpm models:fetch
```

The script tries **ModelScope (China mirror, default) → Hugging Face**, dropping the file at `public/_models/modnet.q.onnx` (~6.32 MB, INT8 quantized, SHA-256 `92e49898…`). The SHA-384 digest is pinned in [`src/features/segmentation/integrity.ts`](src/features/segmentation/integrity.ts) (`MODEL_SHA384`) and verified at runtime after download.

> ModelScope is Alibaba's Hugging Face mirror — same bytes (`X-Linked-Etag` matches), directly reachable inside China. HF's `cas-bridge.xethub.hf.co` is often DNS-poisoned there.

### Fallbacks

If the default download fails (corporate proxy / restricted network), three options:

1. **Manual browser download**
   - ModelScope (recommended): <https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx>
   - Hugging Face (needs network access): <https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx?download=true>

   Then import:

   ```bash
   pnpm models:fetch --from-file ~/Downloads/model_quantized.onnx
   ```

2. **Proxy**

   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch
   ```

3. **Custom URL** (e.g. self-hosted on R2 / your own CDN)

   ```bash
   MODEL_URL=https://cdn.pix-fit.com/models/modnet.q.onnx pnpm models:fetch
   ```

> If upstream updates the model, the SHA-384 check fails at runtime — bump `MODEL_SHA384` in [`integrity.ts`](src/features/segmentation/integrity.ts).

## Routes

Every public route is statically generated under `/[locale]/...` for all three locales (`zh-Hans` / `zh-Hant` / `en`, default `zh-Hans`).

| Route                | Content                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `/`                  | Home · landing + upload                                                  |
| `/studio`            | Studio · cutout / background / crop / layout / export (supports `?tab=`) |
| `/scanner`           | **Sub-product** · Document Scan Generator                                |
| `/scanner/[docType]` | DocSpec SEO landing page (12 × 3 = 36 SSG pages)                         |
| `/sizes`             | All 28 built-in photo specs (SEO index)                                  |
| `/sizes/[specId]`    | Per-spec detail (with HowTo / FAQ JSON-LD)                               |
| `/paper`             | 7 built-in paper stocks                                                  |
| `/templates`         | 12 built-in layout templates                                             |
| `/specs`             | Spec manager · custom PhotoSpec / PaperSpec / LayoutTemplate             |
| `/privacy`           | Privacy policy                                                           |
| `/terms`             | Terms of service                                                         |
| `/sitemap.xml`       | All routes × three locales (hreflang alternates included)                |
| `/robots.txt`        | Public crawl rules                                                       |

Dev-only routes (`/dev/*`) are hidden by default; set `NEXT_PUBLIC_ENABLE_DEV_PAGES=1` to enable them.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript 5.6
- Tailwind CSS v4 + shadcn/ui (New York) + Lucide / flag-icons
- next-intl v4 (route-based i18n via the `/[locale]/` segment)
- State: Zustand
- Imaging: ONNX Runtime Web (MODNet) + MediaPipe Tasks Vision + native Canvas / OffscreenCanvas + jsPDF + `pdfjs-dist`
- Hand-ported perspective rectification (no OpenCV) running in a Web Worker
- Deploy: Cloudflare Workers via `@opennextjs/cloudflare`, and Vercel

## Contributing

Issues and PRs welcome. Please follow:

- Conventional Commits (`feat:` / `fix:` / `chore:` …) — `commitlint` enforces this on the `commit-msg` hook.
- Pre-commit `lint-staged` runs `eslint --fix` + `prettier --write` automatically.
- New i18n keys must land in all three locale files or `pnpm i18n:check` will fail.

## License

[MIT](LICENSE) © 2026 Pixfit Contributors

The background-removal model [`Xenova/modnet`](https://huggingface.co/Xenova/modnet) is Apache-2.0 and shipped separately — not bundled in this repo.

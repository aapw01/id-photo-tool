# Pixfit · 像配

> 浏览器内一站式证件照工作台 — 换底色、裁剪、排版、压缩、导出，照片不离开你的设备。

[![CI](https://github.com/aapw01/id-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/aapw01/id-photo-tool/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-pix--fit.com-10b981.svg)](https://pix-fit.com)

在线体验：<https://pix-fit.com>

## 特性

- **零后端、零登录** — 抠图、合成、压缩、导出全部在浏览器内完成，照片不上传任何服务器。
- **AI 抠图 + 换底** — MODNet 浏览器内推理，发丝级 alpha matte + spill 抑制；预设白 / 蓝 / 红 / 浅灰底，也可自定义任意色。
- **28 条内置规格** — 中国身份证 / 护照 / 一寸两寸、美 / 英 / 申根 / 日 / 韩 / 加 / 澳 / 新 / 俄 / 印 / 马 / 越 / 泰 / 港澳 / 台湾通行证，以及国考 / NCRE / 研究生考试报名照。
- **构图智能对齐** — 基于 MediaPipe 关键点 + MODNet mask 的头部位置自动校准，眼线 / 头部占比落入规格区间。
- **多格式导出** — PNG（透明 / 实底）、JPG、WebP；可压缩到指定 KB（二分搜索 + 像素降采样）；可一键复制到剪贴板。
- **打印排版** — 7 种相纸 × 12 套排版模板，一次冲洗多张照片。
- **完整三语 SEO** — `zh-Hans` / `zh-Hant` / `en`，hreflang × canonical × JSON-LD（WebApplication / HowTo / FAQPage / BreadcrumbList）齐全；28 条规格各有独立 SSR 落地页。

## Pixfit Scanner · 证件扫描生成器

子产品独立路由 `/[locale]/scanner`，把手机翻拍的证件照片变成「真扫描仪」级别的 PDF / PNG。
S1–S8 已全部合并：

- **透视校正** · OpenCV.js（自托管 4.10.0 wasm）懒加载 + Web Worker 端跑 Canny + findContours 自动 4 角检测；识别失败时可手动拖拽 / 键盘方向键微调（Tab 切角，方向键 ±1 px，Shift+方向键 ±10 px）。
- **三种输出模式** · 扫描（彩色 + 自动白平衡）/ 复印（黑白二值化）/ 增强（饱和度 + 对比度），切换不需要重新检测，仅对已校正结果重渲染。
- **强制防滥用水印** · 默认 45° 平铺，文字 / 不透明度 / 密度可调；最低不透明度 30%（合规要求，无法关闭），由用户自定义文字（如「仅供 XX 公司入职审核」）。
- **多 DocSpec / 多纸张** · 内置 11 条 DocSpec（cn / hk / tw / sg / in 身份证、美中驾驶证、中国行驶证、护照资料页、A4 / Letter 全幅文档），可在 A4 / Letter / A5 三种纸张间切换。
- **HEIC / EXIF / 大文件预压缩** · 手机 HEIC 自动转 JPG（`heic2any` 懒加载）；EXIF orientation 自动旋正；长边 > 4000 px 自动降采样防 OpenCV 爆内存。
- **离线 SEO 落地页** · 11 条 DocSpec × 3 语 = 33 个 SSG 落地页（`/[locale]/scanner/[docType]`），每页带 HowTo / FAQ / BreadcrumbList JSON-LD；33 条 URL 全部进 sitemap，hreflang alternates 完整。
- **最近会话** · 导出成功后自动把 _配置_（DocSpec / 纸张 / 输出模式 / 水印）写入 IndexedDB（`idb-keyval`），最多 10 条，TTL 30 天；**不保存任何图像字节**，照片永远不离开浏览器。
- **使用须知 + 法律提示** · 主页底部「使用须知」折叠区块写明本地处理、强制水印、合法用途；服务条款明确禁止伪造 / 冒用。
- **完整 a11y** · 4 角拖拽 SVG 控件全部可键盘操作（role/aria-valuetext），所有 form 控件有 label、所有按钮有 aria-label。

## 文档

- 产品需求：[docs/PRD.md](docs/PRD.md)
- 技术架构：[docs/TECH_DESIGN.md](docs/TECH_DESIGN.md)
- 项目计划：[docs/PLAN.md](docs/PLAN.md)
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- 部署指南：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 任务记录：[docs/tasks/](docs/tasks/)

## 本地开发

环境要求：

- Node.js 22.13+（推荐使用 `nvm`，仓库根有 `.nvmrc`）
- pnpm 11+

```bash
pnpm install
pnpm dev
```

访问 <http://localhost:3000>。

## 常用脚本

```bash
pnpm dev            # 启动开发服务器
pnpm build          # 生产构建
pnpm start          # 启动生产服务器
pnpm lint           # ESLint 检查
pnpm typecheck      # tsc --noEmit
pnpm format         # Prettier 写盘
pnpm test           # vitest run
pnpm i18n:check     # 三语言 key 一致性
pnpm models:fetch   # 拉取 MODNet ONNX 模型到 public/_models/
pnpm cf:build       # 用 OpenNext 打包为 Cloudflare Worker
pnpm cf:deploy      # 构建并部署到 Cloudflare Workers
```

## 部署

仓库**同时**支持两套生产部署，互不冲突：

| 平台                   | 配置文件         | 触发方式                  | 适用场景                                          |
| ---------------------- | ---------------- | ------------------------- | ------------------------------------------------- |
| **Cloudflare Workers** | `wrangler.jsonc` | CF Dashboard Git 集成     | 中国大陆访问优先；流量小（Free 套餐有 CPU 限制）  |
| **Vercel**             | `vercel.json`    | Vercel Dashboard Git 集成 | 海外访问优先；无 CPU 限制；Hobby 免费容量绰绰有余 |

两边的 build 都会先跑 `pnpm models:fetch` 把 MODNet 模型拉到 `public/_models/`，
脚本是幂等的——已存在不会重复下载。详细切换 / 回滚步骤见
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 模型资产

抠图能力使用上游开源模型 [`Xenova/modnet`](https://huggingface.co/Xenova/modnet)（Apache-2.0），
本仓库 **不** 把 `.onnx` 文件提交进 git。首次开发或 CI 跑：

```bash
pnpm models:fetch
```

脚本会按顺序尝试 **ModelScope（国内镜像，默认）→ Hugging Face**，自动落到 `public/_models/modnet.q.onnx`
（约 6.32 MB，INT8 量化，SHA-256 `92e49898...`）。模型 SHA-384 摘要已经固化在
[`src/features/segmentation/integrity.ts`](src/features/segmentation/integrity.ts) 的 `MODEL_SHA384`
常量中——下载完成后运行时会自动校验。

> ModelScope 是阿里维护的 Hugging Face 国内镜像，提供与 HF 完全相同的文件（`X-Linked-Etag` 一致），
> 国内直连可达；HF 当前所有权重都走 `cas-bridge.xethub.hf.co`，在大陆常被 DNS 劫持。

### 备用下载方式

如果默认下载失败（公司内网限制等），三种 fallback：

1. **从浏览器手动下载**（最直观）
   - ModelScope（推荐）：<https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx>
   - Hugging Face（需可访问）：<https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx?download=true>

   然后导入：

   ```bash
   pnpm models:fetch --from-file ~/Downloads/model_quantized.onnx
   ```

2. **设置代理**

   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch
   ```

3. **指定自定义 URL**（例如部署到 R2 后用自己的 CDN）

   ```bash
   MODEL_URL=https://cdn.pix-fit.com/models/modnet.q.onnx pnpm models:fetch
   ```

> 如果上游模型更新，脚本会因 SHA-384 不匹配在运行时报错——届时更新
> [`integrity.ts`](src/features/segmentation/integrity.ts) 的 `MODEL_SHA384` 常量即可。

## 页面

所有正式路由都按 `/[locale]/...` 三语 SSG 出（locale ∈ `zh-Hans` / `zh-Hant` / `en`，默认 `zh-Hans`）。

| 路由                 | 内容                                                         |
| -------------------- | ------------------------------------------------------------ |
| `/`                  | 首页 · 落地 + 上传                                           |
| `/studio`            | 工作台 · 抠图 / 换底 / 裁剪 / 排版 / 导出（支持 `?tab=`）    |
| `/scanner`           | **子产品** · 证件扫描生成器（S1–S8 已上线，端到端可用）      |
| `/scanner/[docType]` | 单条 DocSpec SEO 落地页（11 条 × 3 语 = 33 页 SSG）          |
| `/sizes`             | 28 条内置照片规格列表（SEO 着陆页）                          |
| `/sizes/[specId]`    | 单条规格详情（含 HowTo / FAQ JSON-LD）                       |
| `/paper`             | 7 条内置相纸规格列表                                         |
| `/templates`         | 12 条内置排版模板列表                                        |
| `/specs`             | 规格管理 · 自定义 PhotoSpec / PaperSpec / LayoutTemplate     |
| `/privacy`           | 隐私政策                                                     |
| `/terms`             | 服务条款                                                     |
| `/sitemap.xml`       | 自动收录全部上述路由 × 三 locale（hreflang alternates 齐全） |
| `/robots.txt`        | 公开抓取规则                                                 |

dev-only 路由（`/dev/*`）默认隐藏；需 `NEXT_PUBLIC_ENABLE_DEV_PAGES=1` 才会编译。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript 5.6
- Tailwind CSS v4 + shadcn/ui (New York) + Lucide / flag-icons
- next-intl v4（路由型国际化，`/[locale]/` 段）
- 状态管理：Zustand
- 图像处理：ONNX Runtime Web (MODNet) + MediaPipe Tasks Vision + 原生 Canvas / OffscreenCanvas + jsPDF
- 部署：Cloudflare Workers via `@opennextjs/cloudflare`

## 贡献

欢迎 issue 与 PR。请遵循：

- Conventional Commits（`feat:` / `fix:` / `chore:` …），`commitlint` 会在 `commit-msg` hook 校验。
- 提交前自动跑 `eslint --fix` + `prettier --write`（`lint-staged`）。
- 新增 i18n key 时务必同步三种 locale 文件，否则 `pnpm i18n:check` 会失败。

## License

[MIT](LICENSE) © 2026 Pixfit Contributors

抠图模型 [`Xenova/modnet`](https://huggingface.co/Xenova/modnet) 为 Apache-2.0，单独发布，未随仓库分发。

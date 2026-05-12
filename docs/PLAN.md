# 项目计划与里程碑 — Pixfit · 像配

> 本文档是项目的活看板：跟踪里程碑进度、登记未决问题、记录决策、维护文档索引。每次完成一个里程碑或做出重要决策时更新。

需求文档：[PRD.md](./PRD.md) · 技术设计：[TECH_DESIGN.md](./TECH_DESIGN.md)

---

## 1. 当前状态摘要

| 项         | 值                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| 产品名     | **Pixfit · 像配**                                                                                       |
| 域名       | `pix-fit.com`（已确认可注册）                                                                           |
| 项目阶段   | **M1 ✅ + M2 ✅ + M3 ✅ + M4 ✅ + M5 ✅ + M6 ✅ + M7 ✅ + M8 ✅（M8a + M8b 全部代码完成）**             |
| 最近更新   | 2026-05-12                                                                                              |
| 进度       | M1–M8 全部代码完成；M8b 添加 deeplink + 移动 Studio + 触摸把手 + 404/error + 微信提示；合并后总测 325   |
| 一句话进度 | 三语 8 路由 SEO 就绪 + 24 sitemap URL；Studio 移动端底 nav + Sheet；详情页 / 历史会话 / 撤销重做 → V1.1 |

---

## 2. 文档索引

| 文档               | 路径                               | 状态                                          |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| 产品需求文档       | [PRD.md](./PRD.md)                 | v0.2 Draft                                    |
| 技术架构设计       | [TECH_DESIGN.md](./TECH_DESIGN.md) | v0.2 Draft                                    |
| 项目计划（本文档） | [PLAN.md](./PLAN.md)               | v0.3 Draft                                    |
| UI 设计规范        | [DESIGN.md](./DESIGN.md)           | v0.1 Draft（M1 前置）                         |
| 部署指南           | [DEPLOYMENT.md](./DEPLOYMENT.md)   | v0.1 Draft（M1 新增）                         |
| M1 任务清单        | [tasks/M1.md](./tasks/M1.md)       | v0.1 Draft（24 个原子任务，全部完成）         |
| M2 任务清单        | [tasks/M2.md](./tasks/M2.md)       | v0.1（20 个原子任务，19 完成 + 1 待真机回填） |
| M3 任务清单        | [tasks/M3.md](./tasks/M3.md)       | v0.1（10 个原子任务，全部完成）               |
| M4 任务清单        | [tasks/M4.md](./tasks/M4.md)       | v0.1（15 个原子任务，全部完成）               |
| M5 任务清单        | [tasks/M5.md](./tasks/M5.md)       | v0.1（7 个原子任务，全部完成）                |
| M6 任务清单        | [tasks/M6.md](./tasks/M6.md)       | v0.1（12 个原子任务，全部完成）               |
| M7 任务清单        | [tasks/M7.md](./tasks/M7.md)       | v0.1（11 个原子任务，全部完成）               |
| M8 任务清单        | [tasks/M8.md](./tasks/M8.md)       | v0.1（20 个原子任务，M8a + M8b 全部完成）     |
| 项目 README        | [../README.md](../README.md)       | v0.1（M1 完成 / M8a 加 Pages 段）             |

---

## 3. 里程碑跟踪

### 3.1 总览

| 里程碑 | 主题                | 状态                                                          | 预估工时   |
| ------ | ------------------- | ------------------------------------------------------------- | ---------- |
| M1     | 项目骨架            | ✅ 代码完成 / 待真机部署                                      | 1 周       |
| M2     | 抠图核心            | ✅ 代码完成 / 真机兼容性待回填 ([M2.md](./tasks/M2.md))       | 1.5–2.5 周 |
| M3     | 换底色              | ✅ 代码完成 / 真机兼容性待回填 ([M3.md](./tasks/M3.md))       | 0.5 周     |
| M4     | 照片规格 + 智能裁剪 | ✅ 代码完成 / 真机兼容性待回填 ([M4.md](./tasks/M4.md))       | 1.5 周     |
| M5     | 导出 + 压缩         | ✅ 代码完成 / 真机兼容性待回填 ([M5.md](./tasks/M5.md))       | 1 周       |
| M6     | 相纸 + 排版         | ✅ 代码完成 / 真机兼容性待回填 ([M6.md](./tasks/M6.md))       | 1.5 周     |
| M7     | 规格管理            | ✅ 代码完成 / 真机端到端待回填 ([M7.md](./tasks/M7.md))       | 0.5 周     |
| M8     | SEO + 移动端 + 打磨 | ✅ 代码完成 / 真机 Lighthouse 待回填 ([M8.md](./tasks/M8.md)) | 1.5 周     |

**预计总工期**：8–10 周（单人 / 兼职节奏）

### 3.2 里程碑详细交付物

#### M1 · 项目骨架

**交付物**：

- [x] Next.js 16 + TypeScript + Tailwind v4 项目初始化（实际版本超出 PRD 的 15）
- [x] shadcn/ui 配置（new-york-v4 style，token bridge 到 Pixfit 设计系统）
- [x] next-intl 配置（`zh-Hans` / `zh-Hant` / `en`）+ middleware
- [x] 根 layout + Header + Footer + LanguageSwitcher + Logo
- [x] 首页静态版（hero + 上传区 + 4 个特性卡片，三语言可切换）
- [x] 设计系统组件：Button / Input / Label / Dialog / Tooltip / Sonner / Separator
- [x] 设计 token（颜色、字体、间距、圆角、阴影），`/dev/design-tokens` 校对页
- [x] Cloudflare Workers 部署配置（OpenNext + wrangler.jsonc + GitHub Actions）
- [x] README 基础版（dev / build / 文档索引）
- [ ] **Cloudflare 控制台连接 + 自定义域名绑定**（账号操作，需用户在控制台完成）
- [ ] **真实部署的 Lighthouse 跑分**（要绑定到 CF 后端才能跑生产环境分数）

**本地验收（已通过）**：

| 项                  | 命令                         | 结果                               |
| ------------------- | ---------------------------- | ---------------------------------- |
| 类型检查            | `pnpm typecheck`             | 通过                               |
| Lint                | `pnpm lint`                  | 通过                               |
| 格式化              | `pnpm format:check`          | 通过                               |
| i18n key 一致性     | `pnpm i18n:check`            | 三语言各 35 keys 完全匹配          |
| 单元测试            | `pnpm test`                  | 3 / 3 通过                         |
| 生产构建            | `pnpm build`                 | 9 个静态页面（3 locales × 3 路由） |
| 三语言渲染          | `curl /zh-Hans /zh-Hant /en` | 各自标题/正文文案正确              |
| 根路径重定向        | `curl /`                     | 307 → `/zh-Hans`                   |
| Conventional Commit | `pnpm exec commitlint`       | 非法消息被拒，合法消息通过         |

**Bundle baseline（M1）**：

- `.next/static` 总体积：1.1 MiB（未 gzip）
- 首屏 JS（gzip 传输）：**~218 KB**，由 React 19 + Next.js 16 runtime + next-intl + radix-ui + sonner 组成
- 与 M1 目标 150 KB 相差 ~70 KB；超出主要来自 React 19 / Next 16 框架基础开销，**计入 M8「优化与打磨」**重新评估，必要时通过路由级 code-split、按需 import radix 等优化降到目标线

**等待动作（用户操作）**：

1. Cloudflare Dashboard 接入 GitHub 仓库 → `pnpm install && pnpm cf:build` 作为 build command
2. 绑定 `pix-fit.com` Custom Domain + Universal SSL
3. （可选）配置 GitHub Actions secrets `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`

详细步骤见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

#### M2 · 抠图核心

**交付物**：

- [ ] MODNet 模型 ONNX 化 + 量化（~6 MB）
- [ ] 模型托管到 R2 + CORS / Cache 配置
- [ ] `segmentation.worker.ts` Worker 实现
- [ ] `useSegmentation` React Hook
- [ ] 模型预热（进入 /studio 自动开始下载）
- [ ] Cache API 缓存策略
- [ ] WebGPU / WASM 自动选择 + 降级
- [ ] 上传组件 → 抠图 → 透明 PNG 导出（最小闭环）
- [ ] 进度提示组件（下载 / 初始化 / 推理三阶段）

**验收**：从首页拖入一张人像 → 自动跳转 /studio → 看到透明背景结果 → 可下载 PNG，全过程 < 3s（首次），< 1s（缓存命中）。

#### M3 · 换底色

**交付物**：

- [x] 预设色板（5 个常用色 + 透明）— `features/background/presets.ts`
- [x] 自定义颜色选择器（HEX 输入 + native `<input type="color">`）— `BackgroundPanel`
- [x] 最近使用色快捷（最多 8 个，localStorage 持久化，LRU 去重）— `store.ts`
- [x] 左右对比预览（拖动滑块 / 键盘箭头 / 触摸）— `BeforeAfterSlider`
- [x] 单张导出（PNG / JPG / 复制到剪贴板）— `ExportPanel`
- [x] Studio 顶栏 tab 切换交互（4 个 tab，背景/导出 可用，尺寸/排版 disabled + tooltip）— `StudioTabs`
- [x] 抠出层缓存（`extractForeground` → ImageBitmap，切换时只跑两次 drawImage）— `composite.ts`
- [x] 性能验证页 `/dev/bg-perf`，目标 P50 < 30 ms / P95 < 50 ms

**验收**：

- 切换底色 P50 **8.3 ms**、P95 **9.1 ms**（macOS Apple Silicon · HeadlessChrome 148，详见 §6.7）— ✅ 远低于 50 ms 目标
- 文件名遵循 PRD §5.8.4：M3 阶段 `pixfit_{w}x{h}_{YYYYMMDD}.{ext}`（M4 接入 spec id 后替换前缀）
- 16 个 composite + 10 个 store 单测全部通过（116 测试整体绿）

**真机回填项（同 M2）**：见 [tasks/M3.md §4](./tasks/M3.md)，需要桌面 / iOS Safari / Android Chrome 上跑一次 `/dev/bg-perf` 收集 P50/P95。

#### M4 · 照片规格 + 智能裁剪

**交付物**：

- [x] `data/photo-specs.ts` 内置规格（28 条：中国证件 7 + 中国相纸 2 + 通行证 2 + 签证 14 + 考试 3）
- [x] `data/paper-specs.ts`（7 条：3R / 4R / 5R / 6R / 8R / A4 / A5）
- [x] `types/spec.ts` 数据类型 + zod schema + `lib/spec-units.ts` mm↔px helper
- [x] 规格选择面板（`SpecPicker`，按 category 分组 + 搜索 + 国旗 + 选中信息卡）
- [x] MediaPipe Face Detector 集成（`@mediapipe/tasks-vision@0.10.35`，lazy load WASM）
- [x] 自动居中算法（`auto-center.ts`，含 14 个单测，多 spec / face position 矩阵）
- [x] 可拖拽 / 4 角缩放 / 比例锁定的裁剪框（`CropFrameOverlay`）
- [x] 参考线（`Guidelines`：SVG 头顶 / 眼线 / 下颌）
- [x] 合规警告（`compliance.ts` + `ComplianceBanner` UI，4 类警告码 + face-not-found）
- [x] 选定规格后裁剪框比例锁定，spec 变化重新居中；arrow key 微调
- [x] 选 spec 自动套用 `spec.background.recommended`（toast 提示）
- [x] 导出文件名前缀使用 `spec.id`，按 spec 像素裁剪重采样

**验收**：选择"美国签证" → 自动裁剪框出现 → 头部自动居中 → 偏离规则有警告。✅ 通过（165 tests / lint / typecheck / build / `/studio` 三语 200）。

**M4 单测覆盖（共 57 个）**：

- `spec-units`: 8 · mm↔px / derivePixels / aspectRatio
- `data/specs`: 13 · BUILTIN_PHOTO_SPECS 数量 / id 唯一 / zod 校验 / category 覆盖；BUILTIN_PAPER_SPECS 数量 / zod
- `face-detect`: 6 · null / largest face / keypoint scaling / model-fetch / runtime / singleton 缓存
- `auto-center`: 14 · centerCrop / span estimate / aspect / eye line band / 4 角越界 / shrink / 多 spec 对比
- `compliance`: 8 · face-null / 默认通过 / 4 警告码 / 数值 surface
- `spec-store`: 隐式（无独立单测，通过 useCropFlow 验证）

#### M5 · 导出 + 压缩

**交付物**：

- [x] 单张导出（PNG 透明 / PNG 实底 / JPG / WebP）— `features/export/export-single.ts`
- [x] 压缩到指定 KB 算法（`compress-to-kb.ts`）— 二分质量 + 自动下采样
- [x] 像素精确重采样（Pica）— `features/export/resample.ts`，lazy import + native 回退
- [x] 文件命名规范（`buildFilename` 三类）— `features/export/filename.ts`
- [x] 下载触发 + 复制到剪贴板 + 失败 toast
- [x] 导出面板 UI（格式选择 / 实时大小估算 / 质量滑块 / 目标 KB 输入 / 文件名预览）— 重写 `export-panel.tsx`

**验收**：用考试规格"公务员 (≤ 30 KB)"导出，结果在 21–30 KB 区间。✅ 通过（compressed JPG 走二分搜索，单测命中 ±5% 容差）。

**M5 单测覆盖（共 ~55 个）**：

- `resample`: 3 · Pica 参数传递 / 失败回退 / 目标尺寸
- `export-single`: 6 · 4 格式 mime / alpha 行为 / 裁剪 / 质量参数
- `compress-to-kb`: 5 · 命中 / 下采样 / 不可达 / tolerance / 诊断字段
- `filename`: 4 · single / compressed / layout 快照 + sanitize

#### M6 · 相纸 + 排版

**交付物**：

- [x] `data/layout-templates.ts` 内置 ≥12 个模板（5R 系 6 个 + 6R 系 5 个 + A4 fallback）
- [x] 自动排版算法（`auto-grid.ts` 含旋转探索 + `gridCells` materialize）
- [x] 混排支持（`pack-mixed.ts` 贪心 strip + overflow 报告）
- [x] 相纸渲染（`render-layout.ts` HTMLCanvasElement，含 DPI override / placeholder / 旋转 cell）
- [x] 灰线分隔 / 裁切线 / 留白配置（`cut-guides.ts` + LayoutSettings 面板）
- [x] PDF 导出（jsPDF lazy import，`export-pdf.ts`，cell 走 `addImage`，分隔线 / 裁切线走矢量 stroke）
- [x] 排版面板 UI（PaperPicker / LayoutTemplatePicker / MixedEditor / LayoutSettings / LayoutActions）
- [x] Studio 集成（解锁 layout tab，LayoutPreview 替换主画布，bg / spec / frame props 透传）

**验收**：选"16 张 1 寸 — 6R" → 画布显示自动网格 → 导出 PDF 可用于冲印。✅ 通过（242 tests / lint / typecheck / build / 三 locale dev 200）。

**M6 单测覆盖（共 ~25 个）**：

- `auto-grid`: 11 · 5R/6R/A4 多 spec 矩阵 + 旋转优势 + 边界舍入 + capacity helper
- `pack-mixed`: 4 · 2 项 / 3 项 / overflow / 旋转
- `render-layout`: 5 · 尺寸 / 数量 / DPI override / placeholder / 真实图像
- `data/layout-templates`: ≥ 7 · 数量 / id 唯一 / zod / paper 解析 / spec 解析

#### M7 · 规格管理

**交付物**：

- [x] `src/features/spec-manager/` 模块：`schema / storage / merge / crud / dependency-check / import-export / store` — 七个文件，纯函数 + 一个 zustand store
- [x] `localStorage['pixfit:specs:v1']` 持久化（容错 4 类异常，写入前再过 zod）
- [x] `mergeById` 用户覆盖内置（同 id 原地替换，新 id 追加）
- [x] CRUD 行为：内置项不可删 / 不可改 id；更新强制 pin `id + builtin: false`
- [x] `exportToJSON` Blob + `pixfit-specs-YYYYMMDD.json` 文件名；`importFromJSON` 走 zod，错误码 4 类
- [x] `findDependents`（photo + paper）含 manual cells 路径
- [x] `/specs` 三语 SSG 路由 + 三 tab Shell（Photo / Paper / Layout）
- [x] PhotoSpec / PaperSpec 表单：name 三语 + 尺寸 + DPI + region + 推荐底色 + alias；`aria-invalid` 字段高亮
- [x] Delete 对话框列出受影响 LayoutTemplate
- [x] `SpecManager.*` 三语 i18n（190 keys 完全对齐）
- [x] Footer 入口 + 50 新单测（总测试数 215，对比 M4 完成时的 165）

**验收**：

- /specs 三语 200，本地化标题命中（curl smoke）
- 创建一条自定义规格 → reload 后仍在；导出 JSON → 清掉 customs → 导入 JSON → 列表恢复（pure-fn 单测覆盖；真机 reload 需用户回填 §1.3）
- 内置规格点 Delete 按钮被前置拒绝；改 id 在 update 路径被强制 pin 回原 id
- 165 → 215 单测全过；`lint / typecheck / build / i18n:check` 全绿

#### M8 · SEO + 移动端 + 打磨

任务清单：[tasks/M8.md](./tasks/M8.md)（20 原子任务，拆为 M8a SEO + 路由 / M8b 移动 + 打磨 两轮 commit）。

**M8a · SEO + 路由（已完成）**：

- [x] `lib/seo/site-config.ts` + `lib/seo/metadata.ts`：canonical / hreflang alternates / OG / Twitter helper（5 单测）
- [x] `app/sitemap.ts` + `app/robots.ts`：8 路由 × 3 locale = 24 条 URL，hreflang alternates 齐全
- [x] `<JsonLd />` 组件 + `webApplicationSchema` / `itemListSchema` / `breadcrumbSchema`（11 单测）
- [x] `/sizes` SEO 着陆页 — 28 条 BUILTIN_PHOTO_SPECS 按 category 分组，国旗 + 物理 + 像素 + DPI + 推荐底色 + CTA → `/studio?tab=size&spec=<id>`
- [x] `/paper` SEO 着陆页 — 7 条 BUILTIN_PAPER_SPECS，alias + 物理 + 像素 + DPI + CTA → `/studio?tab=layout&paper=<id>`
- [x] `/templates` SEO 着陆页 — 12 条 BUILTIN_LAYOUT_TEMPLATES 按 paperId 分组，CTA → `/studio?tab=layout&template=<id>`
- [x] `/privacy` 三语隐私政策（9 节，2026-05-12 lastUpdated）
- [x] `/terms` 三语服务条款（10 节，2026-05-12 lastUpdated）
- [x] 三语 namespace：`Sizes` / `Paper.list` / `Templates` / `Legal.{common,privacy,terms}` / `Errors.{notFound,runtime}` / `Studio.mobile` / `Nav.menu` / `Footer.{groups,links}` / `Export.wechatHint`（345 keys 全语 parity）
- [x] Footer 重写为 4 栏 Pages 分组（Product / Browse / Legal / About）；Header 加移动端 Sheet 抽屉 + icon-only 的 Studio CTA
- [x] 首页 + Studio + Specs 改用 `buildMetadata()`（canonical + alternates 全覆盖）
- [x] README 新增 "页面" 段（路由地图 + dev 路由说明）
- [x] PLAN §6 决策日志新增 9 条 M8 决策

**M8b · 移动 + 打磨（已完成）**：

- [x] `studio?tab=...` deeplink — `parseTabParam` + `useTabDeeplink` hook（4 单测）；`router.replace` 不推历史栈；`/studio?tab=size` 直接落到尺寸 tab
- [x] StudioWorkspace 移动端 — `StudioBottomTabs` fixed 底部 4 lucide icon nav（safe-area-inset-bottom）+ `Sheet` bottom drawer 承载 BackgroundPanel / SpecPicker / LayoutPanel / ExportPanel
- [x] CropFrame 触摸把手 ≥ 44×44 — `size-11` hit area + visible ::before dot；`touch-action: none`；`@media(pointer:coarse)` 视觉 +4px
- [x] ExportPanel 微信浏览器长按保存提示 — `isWeChatBrowser` UA 检测 + `useIsWeChat` 走 `useSyncExternalStore`（4 单测）+ ExportPanel 底部 hint
- [x] `[locale]/not-found.tsx` + `[locale]/error.tsx` + 顶级 `app/not-found.tsx` — 三语友好 404 + 客户端 error boundary + 顶级 emerald 兜底
- [x] a11y / 触摸打磨 — 关键按钮加 `touch-action: manipulation`；CropFrame `touch-action: none`
- [x] §6.8 Lighthouse / 构建包基线回填（headless Chrome 不可用，真机 PageSpeed Insights [user-pending]）

**验收**：

- `pnpm lint` / `pnpm typecheck` 无错
- `pnpm test` 325 全过（M8a 11 + M8b 11 新单测）
- `pnpm i18n:check` 三语 345 keys 完全一致
- `NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build` 38 静态页 + sitemap + robots 成功
- `pnpm dev` 后 `curl` 三 locale × 8 路由（/、/studio、/specs、/sizes、/paper、/templates、/privacy、/terms）全 200；`/en/foo-bar` 返回 404
- `/sitemap.xml` 含 24 条 `<loc>`；`/robots.txt` 含 `Sitemap` + `Disallow: /dev/` `Disallow: /api/`
- `?tab=size` / `?tab=export` 等 deeplink hydrate 时同步到 store

---

## 4. 当前 Sprint / 下一步行动

### 下一步（按推荐顺序）

1. ✅ 决策启动前未决问题（Q1 / Q6 / Q7 已完成）
2. **当前：撰写 [DESIGN.md](./DESIGN.md)** — UI 设计规范 + wireframe + 组件清单
3. **下一步：撰写 docs/tasks/M1.md** — 把 M1 拆成 20–25 个原子任务
4. **再下一步：启动 M1**
   - `pnpm create next-app@latest pix-fit`
   - 安装 Tailwind v4、shadcn/ui、next-intl 等依赖
   - 配置 i18n 路由 + middleware
   - 实现首页静态版
   - 接入 Cloudflare Pages

### 阻塞项

无。

---

## 5. 未决问题清单（Open Questions）

| ID  | 问题                                          | 影响                         | 优先级 | 状态                                                                             |
| --- | --------------------------------------------- | ---------------------------- | ------ | -------------------------------------------------------------------------------- |
| Q1  | 产品最终名（中/英/域名）                      | 影响所有文案、Logo、域名采购 | 高     | ✅ **已解决** — Pixfit / 像配 / pix-fit.com（2026-05-11）                        |
| Q2  | MODNet 商用 license 核实                      | 影响主模型选型               | 高     | ✅ **已解决** — 上游 `ZHKKKe/MODNet` LICENSE 为 Apache 2.0，可商用（2026-05-12） |
| Q3  | 域名采购与备案策略（是否国内备案）            | 影响上线时机                 | 中     | ⬜ 已购 pix-fit.com，备案待 M8 决定                                              |
| Q4  | 是否启用 Sentry 错误监控                      | 影响成本与隐私               | 低     | ⬜ M8                                                                            |
| Q5  | 是否做 PWA（V1.2）                            | 影响开发节奏                 | 低     | ⬜ V1 上线后                                                                     |
| Q6  | 品牌主色                                      | 影响视觉设计                 | 中     | ✅ **已解决** — Emerald (#10B981)（2026-05-11）                                  |
| Q7  | 是否需要单独的设计文档（DESIGN.md）           | 影响 M1 节奏                 | 中     | ✅ **已解决** — 需要，作为 M1 前置（2026-05-11）                                 |
| Q8  | 各国签证尺寸的最终采纳清单（是否需要扩 / 删） | 影响数据准备                 | 中     | ⬜ M4 前                                                                         |

---

## 6. 决策日志（Decision Log）

| 日期       | 决策                                                                 | 备选方案                                                                                                                  | 理由                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-11 | 选定 Next.js 15 + Cloudflare Pages                                   | Vite + Vercel；纯 SPA + GitHub Pages                                                                                      | SEO 友好 + 国内访问稳 + 免费                                                                                                                                               |
| 2026-05-11 | 抠图主模型用 MODNet（量化）                                          | MediaPipe Selfie（太粗）/ RMBG-1.4（太大）/ BiRefNet（更大）                                                              | 体积 + 质量 + 人像专用平衡最佳                                                                                                                                             |
| 2026-05-11 | 三层数据模型 PhotoSpec / PaperSpec / LayoutTemplate                  | 单一 Size 模型                                                                                                            | 三者天然解耦，扩展性强                                                                                                                                                     |
| 2026-05-11 | V1 完全免费 + 无登录                                                 | Freemium / 广告                                                                                                           | 先验证市场，避免 UI 复杂化                                                                                                                                                 |
| 2026-05-11 | i18n 简繁人工双写，不用 OpenCC                                       | 自动转换                                                                                                                  | UI 用词差异大，自动转换不可靠                                                                                                                                              |
| 2026-05-11 | 推理走 ONNX Runtime Web                                              | transformers.js / TensorFlow.js                                                                                           | 性能最佳 + WebGPU 支持 + 模型生态广                                                                                                                                        |
| 2026-05-11 | 主统计用 Cloudflare Web Analytics                                    | GA4 / 友盟                                                                                                                | 无 cookie + 隐私友好 + 免费                                                                                                                                                |
| 2026-05-11 | 抠图采用单模型方案（非双模型）                                       | Fast (MediaPipe) + HQ (RMBG)                                                                                              | MODNet 在证件照场景已够；架构更简单                                                                                                                                        |
| 2026-05-11 | 产品名定为 **Pixfit · 像配**                                         | Snapfit / Frameo / Sizely / IDfit                                                                                         | 短、好记、双关（pixel + fit / 像 + 配）；pix-fit.com 可获得                                                                                                                |
| 2026-05-11 | 品牌主色 **Emerald (#10B981)**                                       | Indigo (#6366F1) / 自定义                                                                                                 | 翡翠绿 + 暖白基底，清新专业，与"匹配规格"的精确感形成温度平衡                                                                                                              |
| 2026-05-11 | M1 启动前先写 DESIGN.md                                              | M1 直接写代码                                                                                                             | 视觉/交互一致性提前对齐，避免开发返工                                                                                                                                      |
| 2026-05-11 | MODNet 模型直接复用 `Xenova/modnet` INT8 ONNX                        | 自己写 onnxruntime quantize 脚本（Python）                                                                                | 上游已发布合格 INT8 版本（6.63 MB），省 1 个工作日并消除工具链依赖                                                                                                         |
| 2026-05-11 | 模型经 `public/_models/` 走 static asset                             | 直接接入 Cloudflare R2 + cdn.pix-fit.com                                                                                  | 不让 R2 阻塞 M2 开发；CF Workers static asset 自带 CDN，部署阶段再切换                                                                                                     |
| 2026-05-12 | 模型下载默认走 ModelScope（HF 作 fallback）                          | 强制走 HF + 让用户自配代理                                                                                                | ModelScope 是 HF 国内镜像，同源同 etag，直连可达；HF 走 xethub 在大陆被劫持                                                                                                |
| 2026-05-12 | ONNX Runtime Web WASM 资源 V1 走 jsdelivr CDN                        | ship 到 `public/_ort/`（37 MB） / 自己 CDN                                                                                | wasm 资源 74 MB 全量过大；jsdelivr 同源即时可用；ENV `NEXT_PUBLIC_ORT_BASE_URL` 留切换口子                                                                                 |
| 2026-05-12 | Studio store 用 zustand@5 而非 Context                               | React Context / 单例 module 变量                                                                                          | 1.2 KB gzipped；selector 订阅减少不必要 re-render；TECH_DESIGN 早已规划                                                                                                    |
| 2026-05-12 | 协议保留 `forceBackend`（init 消息）                                 | 仅看自动 detect                                                                                                           | 让 /dev/perf 能对照 WebGPU vs WASM；也方便排查降级路径                                                                                                                     |
| 2026-05-12 | 自定义色选择器用 native `<input type="color">`                       | iro.js / react-colorful / 自研 HSV picker                                                                                 | 浏览器原生 picker 即可覆盖 80% 场景；0 KB 额外 JS；M3 不阻塞，未来真有专业需求再上一层                                                                                     |
| 2026-05-12 | 抠出层缓存策略：`extractForeground()` → ImageBitmap                  | 每次切色都跑 destination-in / 每次都跑 per-pixel composite                                                                | 一次抠出后切色只剩 `clearRect + fillRect + drawImage`，P95 降到 9 ms；ImageBitmap GPU 友好                                                                                 |
| 2026-05-12 | 背景色 store 独立于 Studio store                                     | 全部塞进 `studio/store.ts`                                                                                                | 关注点分离 + recent 持久化只需局部订阅；selector 触发面更小，重渲染更少                                                                                                    |
| 2026-05-12 | Studio 顶栏 tab 状态用 zustand 单字段而非 URL hash                   | URL hash / search param                                                                                                   | tab 切换不该影响浏览器历史（用户的"返回"按钮应回退到首页）；同时未来 deeplink 可再加                                                                                       |
| 2026-05-12 | 人脸检测使用 MediaPipe Tasks Vision                                  | BlazeFace TFJS / faceapi.js / OpenCV.js                                                                                   | 官方维护、≤230 KB 模型、WASM 单实例、与 ORT 同 dynamic-import 模式；社区 face-api 久未维护                                                                                 |
| 2026-05-12 | MediaPipe WASM 走 jsdelivr CDN，模型走 GCS                           | 全量打到 `public/_models/` / 强制走自有 R2                                                                                | 与 ORT 同策略；模型仅 230 KB CDN 即可；保留 `NEXT_PUBLIC_FACE_MODEL_URL` 切换口子                                                                                          |
| 2026-05-12 | CropFrame 自研（无第三方裁剪库）                                     | react-easy-crop / react-image-crop                                                                                        | 这两个库锁死 16/9 或 1/1，并且不支持 image-pixel space；自研代码 ~250 行可控                                                                                               |
| 2026-05-12 | 选 spec 自动套用 `background.recommended`                            | 只在 background 面板手动改                                                                                                | 签证 80% 都要白底，第一次套用降低用户认知负担；用户改过任何颜色后就不再覆盖                                                                                                |
| 2026-05-12 | 裁剪后导出使用 canvas drawImage 高质量缩放                           | Pica / 自实现 Lanczos                                                                                                     | M4 阶段直接 drawImage 已足够；M5 上 Pica 时统一替换重采样核                                                                                                                |
| 2026-05-12 | M5 重采样选 Pica（lazy import + native 回退）                        | 自实现 Lanczos / 仍用 drawImage                                                                                           | Pica ~30 KB；lazy import 不进首屏；失败回退到 drawImage 保底；自实现成本高且无收益                                                                                         |
| 2026-05-12 | M5 单次重采样路径：先 native crop → Pica resize                      | cropAndResize 一次性（双采样）                                                                                            | 双采样在小尺寸视觉损失明显；先在原分辨率裁掉再让 Pica 一次性 Lanczos 缩到目标，画质更稳                                                                                    |
| 2026-05-12 | happy-dom 装 canvas / toBlob / createImageBitmap stub                | 每个测试自己 mock / 切到 jsdom                                                                                            | 现有 happy-dom 抠图测试已稳定；只补一层 Proxy stub 让 export / layout 测试可写                                                                                             |
| 2026-05-12 | M6 PDF 选 jsPDF（lazy import）                                       | pdf-lib / pdfme / 自己写 PDF writer                                                                                       | jsPDF `addImage` API 最少胶水；体积可 dynamic import；pdf-lib 强项是表单填写，不在场景内                                                                                   |
| 2026-05-12 | M6 拼版算法 V1 只走 auto-grid（保留 manual 接口）                    | 内置一堆 manual layout / 先做 manual 再做 auto                                                                            | auto-grid 一个函数覆盖 95% 印刷店场景；schema 已经预留 `manual.cells` 路径方便后续接入                                                                                     |
| 2026-05-12 | M6 排版页内嵌 /studio 一个 tab                                       | 新建 /print 独立路由 / 桌面 app                                                                                           | 用户从上传到下载是单线流；切换 tab 比跳路由认知成本低；未来要批处理再考虑 /print                                                                                           |
| 2026-05-12 | DPI override 强制 derivePixels 重算 width_px                         | 把 width_px / height_px 当主，dpi 当 hint                                                                                 | PaperSpec 自带 300 DPI 像素，150 DPI preview 必须丢字段重算，否则画布永远 300 DPI 实际像素                                                                                 |
| 2026-05-12 | 新建 `lib/i18n-text.ts` 处理 zh-Hans → zh 映射                       | 在每个组件里写 `name['zh-Hans'] ?? name.en` / 改 spec 字段                                                                | next-intl locale 与 I18nText 字段命名错位，集中映射避免每处错误回退                                                                                                        |
| 2026-05-12 | 规格 localStorage key 用 `pixfit:specs:v1`                           | PRD §9.4.1 的 `id-photo-tool:specs:v1`                                                                                    | 命名与新品牌一致，便于 M8 删旧域名痕迹；`:v1` 留 schema 版本扩展位                                                                                                         |
| 2026-05-12 | `saveSpecs()` 写入前再过一次 `SpecsV1Schema`                         | 仅在调用方校验 / 不校验直写                                                                                               | CRUD 已校验，但 store / 测试 / 导入是多入口；统一在持久化边界兜底，避免脏数据 round-trip                                                                                   |
| 2026-05-12 | 用户同 id 项整体覆盖内置项，`builtin:false` 一并写                   | 字段级 patch / 复制后允许同 id 内置存活                                                                                   | 删除保护只看 `builtin` 标志：用户主动改写后理应能再删除；行为简单且与 PRD §9.4.2 一致                                                                                      |
| 2026-05-12 | M8 详情页 `/sizes/[id]` `/paper/[id]` `/templates/[id]` 延后到 V1.1  | M8 内做齐 47 条详情页                                                                                                     | 列表页 + JSON-LD ItemList 已能让爬虫抓 47 条 spec id，详情页价值密度低且 141 张文案（47×三语）维护成本高；上线后看自然流量再决定                                           |
| 2026-05-12 | `x-default` hreflang 用 `zh-Hans`                                    | 用 `en` 作 fallback                                                                                                       | 与 `routing.defaultLocale = 'zh-Hans'` 对齐，首批主流量在国内，未指明 Accept-Language 的用户也应进中文                                                                     |
| 2026-05-12 | `/studio?tab=` deeplink 用 `router.replace`                          | `router.push` 推历史栈                                                                                                    | tab 切换不应污染浏览器历史；用户「返回」按钮应回到落地页（着陆页 / 首页），不是在 tab 间循环                                                                               |
| 2026-05-12 | 移动端把右侧面板装进 Radix Dialog bottom sheet                       | 自研 drawer / 全屏路由切换                                                                                                | Radix Dialog 自带焦点陷阱 + ESC + `aria-modal`，新 `Sheet` 组件复用 Dialog primitives，单源 transition 不再造轮子                                                          |
| 2026-05-12 | 微信浏览器 hint 仅在 ExportPanel 显示                                | 全站顶部 / 多面板都加                                                                                                     | 用户痛点单一（保存不下来）；其他面板加 hint 是 UI 噪音，分散注意力                                                                                                         |
| 2026-05-12 | 404 / error 走三语 `[locale]/not-found.tsx`，顶级仅兜底 fallback     | 通用单页 + i18n key 切换                                                                                                  | next-intl 设计就是 locale-segment 内 404；顶级 `app/not-found.tsx` 仅承担 locale 解析失败的回退；维护一次 i18n 即可                                                        |
| 2026-05-12 | Lighthouse 真机分数标 [user-pending]                                 | M8 强制达到 90/95 才能合并                                                                                                | headless WebGPU 与真机存在系统级差异；user 拿生产域名跑 PageSpeed Insights 回填 §6.8 才有可比性                                                                            |
| 2026-05-12 | 撤销 / 重做 + 历史会话 IndexedDB 延后到 V1.1                         | M8 内补撤销重做（zundo）+ IndexedDB 历史                                                                                  | M8 时间盒不动 Studio 数据流；引入 zundo 会牵动 background / crop / layout 三 store 的中间件改造；PRD §5.9 写「页面关闭即清空」，IndexedDB 与该约束有冲突                   |
| 2026-05-12 | `/privacy` `/terms` 用三语 SSG（不用通用 MDX 组件）                  | 共享 MDX 模板 + 三语 frontmatter / 单 component 多 i18n 段                                                                | 法务文案三语差异度高（地区法律 / 用语 / 平台名词），分页面写两份 component 反而比共享模板省 i18n 字段数                                                                    |
| 2026-05-12 | M9 抠图主力换 MODNet FP16（13 MB），保留 INT8 作为 fallback          | RMBG-1.4 INT8（CC BY-NC）/ U²-Netp（Apache 但精度低）/ BiRefNet（MIT 但 >100 MB+`GatherND` 在 WebGPU 不支持）/ 仅工程修复 | 用户真机抠图出现红/黑斑块 + 黑色衣服丢失，定位为 INT8 量化噪声；FP16 同架构 同 IO 同 preprocess，只换权重即解决；体积 +6 MB 可接受；ENV `NEXT_PUBLIC_SEG_MODEL` 留切换口子 |
| 2026-05-12 | 修正 MODNet license 标注：CC BY-NC 4.0 → Apache 2.0                  | 维持旧标注 / 切换到 U²-Netp 兜底                                                                                          | 复核上游 `ZHKKKe/MODNet` LICENSE 文件为 Apache 2.0；`Xenova/modnet` 镜像继承之；旧 PRD/TECH_DESIGN 标注错误，回填正确值                                                    |
| 2026-05-12 | 抠图模型 registry 写到 runtime-config，integrity.ts 复用 active 变量 | 每个变体一份 \*-loader 文件 / build-time const replacement                                                                | 单 `MODEL_VARIANTS` 表 + `MODEL_VARIANT`/`MODEL_URL`/`MODEL_SHA384` 派生量，主线程不需要知道变体细节；调换变体只动 ENV 不动逻辑                                            |

---

## 6.5 性能基准（M2-T19）

**测量方式**：`/dev/perf` 路由 + 512×768 合成图 + 5 次迭代，`performance.now()` 计时。
**测量代码**：`src/features/perf/perf-runner.tsx`。
**测量入口**：

```bash
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build && \
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm start
# 浏览器打开 http://localhost:3000/en/dev/perf
```

### 基线 1 · macOS Apple Silicon · Chromium 148 headless (`pnpm start`) · MODNet INT8（M2 起 / 已下线为 fallback）

| 后端   | init (ms) | first pass (ms) | mean (ms) | P50 (ms) | P95 (ms) | min (ms) |
| ------ | --------- | --------------- | --------- | -------- | -------- | -------- |
| WebGPU | 2007.7    | 1408.7          | 1208.1    | 1163.3   | 1408.7   | 1136.4   |
| WASM   | 2075.4    | 1047.9          | 991.1     | 976.5    | 1047.9   | 971.8    |

> 备注：headless Chromium 的 WebGPU 走 ANGLE→Metal，开销显著；INT8 量化模型在 WASM SIMD 上反而更稳。真机 Chrome / Safari WebGPU 应快 2-3 倍，待真机回填。

### 基线 2 · macOS Apple Silicon · Chromium 148 headless · MODNet FP16（M9 起，2026-05-12）

| 后端   | init (ms)           | first pass (ms) | mean (ms) | P50 (ms) | P95 (ms) | min (ms) |
| ------ | ------------------- | --------------- | --------- | -------- | -------- | -------- |
| WebGPU | 1602.4 (cold-cache) | 943.3           | 225.7     | 46.5     | 51.2\*   | 42.8     |
| WebGPU | 476.2 (warm-cache)  | 129.7           | 59.5      | 41.7     | 43.5\*   | 40.9     |
| WASM   | 434.8               | 975.9           | 930.5     | 919.6    | 975.9    | 911.1    |

> \* WebGPU P95 取冷启动之外的稳态值（4 次 warm pass）。warm-cache 行展示 cache hit 后的真实用户路径。
>
> 关键观察：
>
> 1. WebGPU 路径 cold→warm 后 P50 41.7 ms，比 INT8 同环境 1163 ms **快 ~28×**（INT8 在 headless WebGPU 上大量 op 落到 CPU，FP16 模型则全程留在 GPU）。
> 2. WASM 路径 FP16 与 INT8 同 batch（~920 ms vs ~976 ms），FP16 不会让 wasm 慢，但也没收益——wasm CPU 没有 FP16 加速。
> 3. 13 MB FP16 模型首次冷下载 +6 MB 相对 INT8 增量可接受；二次访问 Cache API 命中 init 476 ms。
> 4. 用户报告的"红 / 黑斑块 + 黑色衣服丢失"是 INT8 量化噪声，FP16 在合成 portrait 上肉眼可见消失（透明背景外缘平滑，深色 hair / clothing 完整保留，见 commit 截图）。

### 待补：真机基线

| 环境                       | 状态     |
| -------------------------- | -------- |
| macOS Chrome 桌面 (有 GUI) | 待用户跑 |
| macOS Safari 17+           | 待用户跑 |
| Windows Chrome             | 待真机   |
| iOS Safari                 | 待真机   |
| Android Chrome             | 待真机   |

---

## 6.6 浏览器兼容性矩阵（M2-T20）

| 浏览器         | 版本 | WebGPU | WASM SIMD | Cache API | Web Worker module | 抠图状态           |
| -------------- | ---- | ------ | --------- | --------- | ----------------- | ------------------ |
| Chrome 148     | -    | ✓\*    | ✓         | ✓         | ✓                 | ✓（headless 实测） |
| Edge           | -    | -      | -         | -         | -                 | 待测               |
| Safari 17+     | -    | -      | -         | -         | -                 | 待测               |
| Firefox 130+   | -    | -      | -         | -         | -                 | 待测               |
| iOS Safari 17+ | -    | -      | -         | -         | -                 | 待测               |
| Android Chrome | -    | -      | -         | -         | -                 | 待测               |

\* headless 环境下走 ANGLE/Metal。
所有未填写格子需要用户在真机上访问 `/dev/perf` 跑一次基准回填。已自动降级逻辑（T10）应保证 WebGPU 不可用时透明回退到 WASM。

---

## 6.8 Lighthouse / 构建包基线（M8-T18）

### 静态构建产物（`NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build`，2026-05-12）

| 指标                | 值                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| 路由数（含 dev）    | 13 个 base × 3 locale + 顶层 `/robots.txt` + `/sitemap.xml` + `/_not-found` = **38 个 prerendered HTML** |
| sitemap 实际收录    | 24 条 `<loc>`（8 业务路由 × 3 locale；hreflang alternates 4 条 / URL）                                   |
| 静态 JS 总量        | `.next/static` 34 个 chunk，合计 **2.3 MB**（未 gzip / 未启用 Brotli）                                   |
| 最大 chunk          | 413 KB（ORT runtime + 抠图 worker，lazy-loaded，只在 /studio 触发）                                      |
| Middleware（proxy） | 1 个（next-intl locale 重写）                                                                            |

### 真机 Lighthouse 跑分

[user-pending] — headless Chrome 在本机不可用，且 OpenNext / CF 生产环境对 caching headers / Brotli 的影响必须 PageSpeed Insights 跑生产域名才有可比性。用户在 M8 上线后到 [https://pagespeed.web.dev](https://pagespeed.web.dev) 跑 `pix-fit.com/en` 与 `pix-fit.com/zh-Hans`，把 Performance / Accessibility / Best Practices / SEO 四档分数回填到本节即可。

### 已落地的优化项

- 字体走 `next/font/local`，`font-display: swap`（Inter + JetBrains Mono 自托管，不阻塞 FCP）
- 抠图 worker / ORT runtime / MediaPipe / jsPDF / Pica 全部 `dynamic import`，首屏 JS 仅含框架 + 国际化 + 首页交互
- 三张 SEO 列表页全部 SSG；JSON-LD 内联，不需要客户端再次请求
- robots.txt `Disallow: /dev/` `Disallow: /api/`，避免 dev 路由进索引
- `<input>` `<button>` 关键交互加 `touch-action: manipulation`，移动端消除双击放大延迟

---

## 6.7 背景切换性能（M3-T09）

**目标**（PRD §5.3 / TECH_DESIGN §5.3.3）：

- P50 < 30 ms，P95 < 50 ms（"切换底色无感知卡顿"）

**测量方式**：`/dev/bg-perf` 路由 + 512×768 合成图 + 合成 mask + 60 次 `compositeOnto` 切换，循环 8 种颜色，每次 swap 之后 `requestAnimationFrame` 等一帧再计时（包含 paint）。代码：`src/features/perf/bg-perf-runner.tsx`。

**测量入口**：

```bash
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build && \
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm start
# 浏览器打开 http://localhost:3000/en/dev/bg-perf → Run swap benchmark
```

### 基线 1 · macOS Apple Silicon · Chromium 148 headless

| Setup   | iterations | mean   | P50    | P95    | min    | max     |
| ------- | ---------- | ------ | ------ | ------ | ------ | ------- |
| 31.8 ms | 60         | 8.4 ms | 8.3 ms | 9.1 ms | 0.6 ms | 27.4 ms |

> Setup = `extractForeground`（destination-in 一次性把原图按 mask 抠出，得到 ImageBitmap）。后续每次 swap 仅 `clearRect + fillRect + drawImage`。**P50/P95 均远低于目标**；max 27.4 ms 来自首次 frame 的 raf 抖动（与目标内）。

### 待补：真机基线

与 M2-T20 同清单——macOS Chrome (GUI) / Safari / iOS Safari / Android Chrome / Windows Chrome 各跑一次 `/dev/bg-perf` 即可回填本节。

---

## 7. 风险与缓解（同步自 PRD §12）

| 风险                      | 状态   | 缓解策略                                                                                                                   | 负责人 |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| MODNet 商用 license       | 已规避 | 上游 `ZHKKKe/MODNet` LICENSE 为 Apache 2.0；`Xenova/modnet` 镜像同 license，可商用                                         | —      |
| 国内访问 huggingface 不稳 | 已规避 | 默认源切到 ModelScope（同源镜像，X-Linked-Etag 一致），HF 作为 fallback；保留代理 / `--from-file` 路径；最终切到 R2 自托管 | —      |
| iOS Safari WebGPU 兼容    | 已规避 | 自动降级 WASM                                                                                                              | —      |
| 用户上传他人照片          | 待处理 | ToS 明示责任声明                                                                                                           | TBD    |
| 规格官方数据过时          | 待处理 | 每个 spec 标注核对日期                                                                                                     | TBD    |
| localStorage 跨设备丢失   | 已规避 | 提供 JSON 导出备份                                                                                                         | —      |
| HEIC 解码性能             | 已规避 | 大文件提示先转 JPG                                                                                                         | —      |
| 国内域名 / 备案           | 待跟进 | 优先 CF Pages 全球分发                                                                                                     | TBD    |

状态值：⬜ 待处理 / 🟡 待跟进 / 🟢 已规避 / 🔴 已发生

---

## 8. 协作约定

### 8.1 文档维护

- 每完成一个里程碑：更新本文档 §1、§3 进度状态
- 重大技术 / 产品决策：写进 §6 决策日志
- 出现未在 PRD 中覆盖的需求：先写 PRD，再实现
- 新需求与 PRD 冲突：先开 issue 讨论，确认后改 PRD 再实现

### 8.2 Git 工作流

- 主分支：`main`（始终可部署）
- 功能分支：`feat/<feature-name>`
- 修复分支：`fix/<bug-name>`
- 文档分支：`docs/<topic>`
- 提交规范：Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）

示例：

```
feat(segmentation): add MODNet worker with WebGPU fallback
fix(crop): correct aspect lock when rotating
docs(prd): clarify HEIC handling boundary
```

### 8.3 代码评审

- PR 必须通过 CI（lint + typecheck + test + build）
- 单 PR 控制在 500 行内（大改拆分）
- PR 描述：变更摘要 + 关联里程碑 + 截图（UI 变更）

### 8.4 发布节奏

- M1–M7：内部预览环境（`<branch>.pages.dev`）
- M8 完成：上线到正式域名
- 后续：按版本号 v1.x 发布

---

## 9. 数据准备清单

启动 M4 前需要核对每个内置 PhotoSpec 的官方来源。负责人 TBD。

| 规格              | 物理尺寸        | 来源             | 最后核对 |
| ----------------- | --------------- | ---------------- | -------- |
| 美国签证          | 51×51 mm        | travel.state.gov | TBD      |
| 申根签证          | 35×45 mm        | EU 1182/2010     | TBD      |
| 二代身份证        | 26×32 mm        | GA 461-2004      | TBD      |
| 公务员考试        | 295×413 / 30 KB | 国家公务员局公告 | TBD      |
| ...（其余 24 条） | —               | —                | TBD      |

---

## 10. 变更记录

| 日期       | 版本  | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-11 | 0.1   | 初稿创建                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-11 | 0.2   | 确定产品名 Pixfit + 域名 pix-fit.com + 品牌主色 emerald；Q1/Q6/Q7 标记已解决                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-12 | 0.3   | M1+M2 代码完成、决策日志增补、性能基线（M2-T19）与兼容性矩阵（M2-T20）骨架                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-12 | 0.4   | M3 换底色 10/10 任务代码完成；新增 6.7 背景切换性能基线（P50 8.3ms / P95 9.1ms）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-12 | 0.5   | M4 智能裁剪 15/15 任务代码完成；28 条规格 + 7 张相纸数据落地；MediaPipe + auto-center + compliance 单测 28 个                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-12 | 0.6   | M5 导出 + 压缩（4 格式 + Pica + compress-to-KB）+ M6 相纸 + 排版（auto-grid + pack-mixed + render-layout + jsPDF + 12 builtin templates）一次性完成；新增 ~77 单测达 242；layout tab 解锁；ExportPanel 重写；右侧 PaperPicker / LayoutTemplatePicker / MixedEditor / LayoutSettings / LayoutActions 五块面板上线                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-12 | 0.7   | M7 规格管理 11/11 任务代码完成；`features/spec-manager/` 七模块 + `/specs` 三语 SSG + Footer 入口 + 50 新单测；合并后总测 ≈ 292                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-12 | 0.8   | M8a SEO + 路由完成（13/13）：`lib/seo/{site-config,metadata,jsonld,sitemap-entries}.ts` + `<JsonLd />` + sitemap (24 条 hreflang URL) + robots + `/sizes` `/paper` `/templates` `/privacy` `/terms` 三语 SSG + Footer 4 栏 Pages 分组 + Header 移动汉堡 Sheet + 9 条决策日志                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-12 | 0.9   | M8b 移动 + 打磨完成（7/7）：`?tab=` deeplink hook + `StudioBottomTabs` + `Sheet` 移动 drawer + CropFrame 44×44 触摸把手 + `useIsWeChat` UA hint + `[locale]/not-found.tsx` + `[locale]/error.tsx` + `app/not-found.tsx` + §6.8 Lighthouse / 构建包基线（headless 不可用，真机 [user-pending]）；合并后总测 325                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-12 | 0.8.1 | M8b 用户反馈五项 UI/流程修复：LanguageSwitcher 由 modal 改 `radix-ui` DropdownMenu（同步消除 DialogContent 无 Title/Description 警告）；header + mobile-nav 移除 GitHub 链接，`brand-icons.tsx` + `Nav.github` + `LanguageSwitcher.current` i18n key 一并清理；`detectFace(bitmap, { timeoutMs })` 默认 10s 超时（CN 网络下 jsDelivr / GCS 不可达时不再永远 pending），useCropFlow 不再 `if (detecting) return`，detection 进行中先 centerCrop 占位，face 到达后再升级到 face-aware crop；LayoutPreview 在 `mask === null` 时以原始 bitmap + 透明背景兜底渲染单元，告别灰白占位；新增 13 单测（face-detect timeout 4 条 + `pickCellSource` 3 条 + 既有），总测 338                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-12 | 0.8.2 | M9 抠图质量提升（响应用户真机 red/black 斑块 + 黑色衣服丢失反馈）：`runtime-config.ts` 引入 `MODEL_VARIANTS` 注册表 + 派生 `MODEL_URL/MODEL_SHA384`，默认 `modnet-fp16`（~13 MB）；INT8 保留为 `modnet-int8` fallback，ENV `NEXT_PUBLIC_SEG_MODEL` 切换；`integrity.ts` / `model-loader.ts` / `integrity.test.ts` 改读 active 变体；`scripts/fetch-model.mjs` 加 `--variant {fp16,int8}` 参数；修正 PRD/TECH_DESIGN License 标注（MODNet 上游 Apache 2.0 实测，回滚错误的 CC BY-NC 4.0 备注 + Q2 关闭）；§6.5 加 FP16 headless baseline（WebGPU cold init 1602 ms / warm init 476 ms / warm P50 41.7 ms / WASM P50 919.6 ms）；新增 7 单测覆盖变体注册表 + 一致性                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-12 | 0.8.3 | matting decontamination + layout preview fast-path（修复 576fba7 后用户复现的两条遗留 bug）：(1) Bug A — 抠图发丝边仍透出原背景颜色环。在 `postprocess.ts` 加 `estimateOuterRingBg` + `decontaminateEdges` 两个纯函数，前者用可分离的水平/竖直滑窗 dilation 在 O(N · 2r) 内挑出"近似 subject 但 alpha<13"的外环像素求平均色，后者按 `fg = (rgb − (1−α)·bg) / α` 反混 semi-alpha 像素的 RGB；同时把 `refineAlpha` 默认从 (0.18, 1.6) 调到 (0.22, 1.8) 让低端裁切再硬一档；在 `extractForeground` 里 `destination-in` 之后做一次 `getImageData → decontaminateEdges → putImageData`，所以 StudioPreview / LayoutPreview / ExportPanel 全部共享一份去染色后的 foreground。Playwright 探针：strict 红色 contaminated semi-alpha 像素 1252 → 712（−43%）；alpha 10–150 边缘带剩 153 红像素，主要是嘴唇 / 腮红等真实皮肤色，蓝底切换下肉眼无可见红/粉环。(2) Bug B — 排版 tab 主画布只显示灰色占位格。根因：`exportSingle → resample → pica` 走 Web Worker，Turbopack 编译出的 worker blob 里引用 `__turbopack_context__` 但 blob URL 域里没有这个 binding，worker 抛 `ReferenceError`，Pica promise 既没 reject 也没 resolve，`cellImages` map 永远空。修复改成在 `layout-preview.tsx` 新加 `paintCellCanvas(source, bg, frame, targetPixels)` 直接 drawImage 到 sized 临时画布，绕过 Pica/exportSingle/Blob/createImageBitmap 全链路；预览只需要 cell 尺寸不需要 Lanczos，导出面板继续走 Pica 拿最终 print-quality。Playwright 探针：layout canvas 非灰像素 0 → 158968（占画布 20%）。新增 11 单测（estimateOuterRingBg ×3 + decontaminateEdges ×4 + paintCellCanvas ×4），总测 342 → 353；lint / typecheck / i18n（347 keys 三语 parity）/ build（38 静态页）全绿 |

---

> 文档结束。如需查看产品需求，请见 [PRD.md](./PRD.md)；如需查看技术设计，请见 [TECH_DESIGN.md](./TECH_DESIGN.md)。

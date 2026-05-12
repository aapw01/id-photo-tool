# 项目计划与里程碑 — Pixfit · 像配

> 本文档是项目的活看板：跟踪里程碑进度、登记未决问题、记录决策、维护文档索引。每次完成一个里程碑或做出重要决策时更新。

需求文档：[PRD.md](./PRD.md) · 技术设计：[TECH_DESIGN.md](./TECH_DESIGN.md)

---

## 1. 当前状态摘要

| 项         | 值                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- |
| 产品名     | **Pixfit · 像配**                                                                       |
| 域名       | `pix-fit.com`（已确认可注册）                                                           |
| 项目阶段   | **M1 ✅ + M2 抠图核心代码全部就绪 / 等待真机兼容性矩阵回填**                            |
| 最近更新   | 2026-05-12                                                                              |
| 进度       | M1 + M2 完成；19/20 任务 ✅，T20 兼容性矩阵在 macOS Chromium 148 已跑通，其它真机待回填 |
| 一句话进度 | /studio 端到端通：上传 → 抠图 → 透明 PNG 下载全部 client-side；下一步进入 M3（换底色）  |

---

## 2. 文档索引

| 文档               | 路径                               | 状态                                  |
| ------------------ | ---------------------------------- | ------------------------------------- |
| 产品需求文档       | [PRD.md](./PRD.md)                 | v0.2 Draft                            |
| 技术架构设计       | [TECH_DESIGN.md](./TECH_DESIGN.md) | v0.2 Draft                            |
| 项目计划（本文档） | [PLAN.md](./PLAN.md)               | v0.3 Draft                            |
| UI 设计规范        | [DESIGN.md](./DESIGN.md)           | v0.1 Draft（M1 前置）                 |
| 部署指南           | [DEPLOYMENT.md](./DEPLOYMENT.md)   | v0.1 Draft（M1 新增）                 |
| M1 任务清单        | [tasks/M1.md](./tasks/M1.md)       | v0.1 Draft（24 个原子任务，全部完成） |
| 项目 README        | [../README.md](../README.md)       | v0.1（M1 完成）                       |

---

## 3. 里程碑跟踪

### 3.1 总览

| 里程碑 | 主题                | 状态                                                    | 预估工时   |
| ------ | ------------------- | ------------------------------------------------------- | ---------- |
| M1     | 项目骨架            | ✅ 代码完成 / 待真机部署                                | 1 周       |
| M2     | 抠图核心            | ✅ 代码完成 / 真机兼容性待回填 ([M2.md](./tasks/M2.md)) | 1.5–2.5 周 |
| M3     | 换底色              | ⬜ 未开始                                               | 0.5 周     |
| M4     | 照片规格 + 智能裁剪 | ⬜ 未开始                                               | 1.5 周     |
| M5     | 导出 + 压缩         | ⬜ 未开始                                               | 1 周       |
| M6     | 相纸 + 排版         | ⬜ 未开始                                               | 1.5 周     |
| M7     | 规格管理            | ⬜ 未开始                                               | 0.5 周     |
| M8     | SEO + 移动端 + 打磨 | ⬜ 未开始                                               | 1.5 周     |

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

- [ ] 预设色板（5 个常用色 + 透明）
- [ ] 自定义颜色选择器（HSV / HEX）
- [ ] 最近使用色快捷
- [ ] 左右对比预览（拖动滑块）
- [ ] 单张导出（PNG / JPG）
- [ ] Studio 顶栏 tab 切换交互

**验收**：切换底色 < 50ms；导出文件命名符合规范。

#### M4 · 照片规格 + 智能裁剪

**交付物**：

- [ ] `data/photo-specs.ts` 内置规格（28 条）
- [ ] `data/paper-specs.ts`（7 条）
- [ ] `types/spec.ts` 数据类型 + zod schema
- [ ] 规格选择面板（按 category 分组）
- [ ] MediaPipe Face Detector 集成
- [ ] 自动居中算法（`auto-center.ts`）
- [ ] 可拖拽 / 缩放裁剪框
- [ ] 参考线（头顶 / 眼线 / 下颌）
- [ ] 合规警告
- [ ] 选定规格后裁剪框比例锁定

**验收**：选择"美国签证" → 自动裁剪框出现 → 头部自动居中 → 偏离规则有警告。

#### M5 · 导出 + 压缩

**交付物**：

- [ ] 单张导出（PNG 透明 / PNG 实底 / JPG / WebP）
- [ ] 压缩到指定 KB 算法（`compress-to-kb.ts`）
- [ ] 像素精确重采样（Pica）
- [ ] 文件命名规范
- [ ] 下载触发 + 成功 toast
- [ ] 导出面板 UI（格式选择 / 目标 KB 输入）

**验收**：用考试规格 "公务员 (≤ 30KB)" 导出，结果在 21–30 KB 区间。

#### M6 · 相纸 + 排版

**交付物**：

- [ ] `data/layout-templates.ts` 内置 12 个模板
- [ ] 自动排版算法（`packer.ts`）
- [ ] 混排支持
- [ ] 相纸渲染（`render-paper.ts`）
- [ ] 灰线分隔 / 裁切线 / 留白配置
- [ ] PDF 导出（jsPDF）
- [ ] 排版面板 UI

**验收**：选"16 张 1 寸 — 6R" → 画布显示 4×4 网格 → 导出 PDF 可用于冲印。

#### M7 · 规格管理

**交付物**：

- [ ] 规格管理弹窗（三 tab：照片 / 相纸 / 排版）
- [ ] CRUD 表单 + zod 校验
- [ ] localStorage 存储 + 加载合并
- [ ] "另存为副本" 功能
- [ ] JSON 导入 / 导出
- [ ] 反向校验（删除前提示依赖）

**验收**：用户创建一个自定义照片规格 → 重新打开浏览器仍存在 → 导出 JSON → 清缓存 → 导入 JSON 恢复。

#### M8 · SEO + 移动端 + 打磨

**交付物**：

- [ ] `/tools/*` 8 个工具着陆页
- [ ] `/size/[slug]` 28 个尺寸专题页（静态生成）
- [ ] 动态 metadata + JSON-LD
- [ ] hreflang / sitemap.xml / robots.txt
- [ ] 移动端布局适配（断点 < 768px）
- [ ] 微交互打磨（hover / 过渡动画 / 加载状态）
- [ ] Lighthouse 调优（达到 ≥ 90 / 95）
- [ ] 错误兜底页面（404 / 500）
- [ ] 隐私政策 / 使用条款 / 关于 三个静态页
- [ ] 正式域名上线

**验收**：所有 `/size/*` 在搜索引擎可见；移动端 iPhone 13 全流程可用；Lighthouse Performance ≥ 90、Accessibility ≥ 95。

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

| ID  | 问题                                          | 影响                         | 优先级 | 状态                                                      |
| --- | --------------------------------------------- | ---------------------------- | ------ | --------------------------------------------------------- |
| Q1  | 产品最终名（中/英/域名）                      | 影响所有文案、Logo、域名采购 | 高     | ✅ **已解决** — Pixfit / 像配 / pix-fit.com（2026-05-11） |
| Q2  | MODNet 商用 license 核实                      | 影响主模型选型               | 高     | ⬜ 待跟进，M2 前                                          |
| Q3  | 域名采购与备案策略（是否国内备案）            | 影响上线时机                 | 中     | ⬜ 已购 pix-fit.com，备案待 M8 决定                       |
| Q4  | 是否启用 Sentry 错误监控                      | 影响成本与隐私               | 低     | ⬜ M8                                                     |
| Q5  | 是否做 PWA（V1.2）                            | 影响开发节奏                 | 低     | ⬜ V1 上线后                                              |
| Q6  | 品牌主色                                      | 影响视觉设计                 | 中     | ✅ **已解决** — Emerald (#10B981)（2026-05-11）           |
| Q7  | 是否需要单独的设计文档（DESIGN.md）           | 影响 M1 节奏                 | 中     | ✅ **已解决** — 需要，作为 M1 前置（2026-05-11）          |
| Q8  | 各国签证尺寸的最终采纳清单（是否需要扩 / 删） | 影响数据准备                 | 中     | ⬜ M4 前                                                  |

---

## 6. 决策日志（Decision Log）

| 日期       | 决策                                                | 备选方案                                                     | 理由                                                                                       |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 2026-05-11 | 选定 Next.js 15 + Cloudflare Pages                  | Vite + Vercel；纯 SPA + GitHub Pages                         | SEO 友好 + 国内访问稳 + 免费                                                               |
| 2026-05-11 | 抠图主模型用 MODNet（量化）                         | MediaPipe Selfie（太粗）/ RMBG-1.4（太大）/ BiRefNet（更大） | 体积 + 质量 + 人像专用平衡最佳                                                             |
| 2026-05-11 | 三层数据模型 PhotoSpec / PaperSpec / LayoutTemplate | 单一 Size 模型                                               | 三者天然解耦，扩展性强                                                                     |
| 2026-05-11 | V1 完全免费 + 无登录                                | Freemium / 广告                                              | 先验证市场，避免 UI 复杂化                                                                 |
| 2026-05-11 | i18n 简繁人工双写，不用 OpenCC                      | 自动转换                                                     | UI 用词差异大，自动转换不可靠                                                              |
| 2026-05-11 | 推理走 ONNX Runtime Web                             | transformers.js / TensorFlow.js                              | 性能最佳 + WebGPU 支持 + 模型生态广                                                        |
| 2026-05-11 | 主统计用 Cloudflare Web Analytics                   | GA4 / 友盟                                                   | 无 cookie + 隐私友好 + 免费                                                                |
| 2026-05-11 | 抠图采用单模型方案（非双模型）                      | Fast (MediaPipe) + HQ (RMBG)                                 | MODNet 在证件照场景已够；架构更简单                                                        |
| 2026-05-11 | 产品名定为 **Pixfit · 像配**                        | Snapfit / Frameo / Sizely / IDfit                            | 短、好记、双关（pixel + fit / 像 + 配）；pix-fit.com 可获得                                |
| 2026-05-11 | 品牌主色 **Emerald (#10B981)**                      | Indigo (#6366F1) / 自定义                                    | 翡翠绿 + 暖白基底，清新专业，与"匹配规格"的精确感形成温度平衡                              |
| 2026-05-11 | M1 启动前先写 DESIGN.md                             | M1 直接写代码                                                | 视觉/交互一致性提前对齐，避免开发返工                                                      |
| 2026-05-11 | MODNet 模型直接复用 `Xenova/modnet` INT8 ONNX       | 自己写 onnxruntime quantize 脚本（Python）                   | 上游已发布合格 INT8 版本（6.63 MB），省 1 个工作日并消除工具链依赖                         |
| 2026-05-11 | 模型经 `public/_models/` 走 static asset            | 直接接入 Cloudflare R2 + cdn.pix-fit.com                     | 不让 R2 阻塞 M2 开发；CF Workers static asset 自带 CDN，部署阶段再切换                     |
| 2026-05-12 | 模型下载默认走 ModelScope（HF 作 fallback）         | 强制走 HF + 让用户自配代理                                   | ModelScope 是 HF 国内镜像，同源同 etag，直连可达；HF 走 xethub 在大陆被劫持                |
| 2026-05-12 | ONNX Runtime Web WASM 资源 V1 走 jsdelivr CDN       | ship 到 `public/_ort/`（37 MB） / 自己 CDN                   | wasm 资源 74 MB 全量过大；jsdelivr 同源即时可用；ENV `NEXT_PUBLIC_ORT_BASE_URL` 留切换口子 |
| 2026-05-12 | Studio store 用 zustand@5 而非 Context              | React Context / 单例 module 变量                             | 1.2 KB gzipped；selector 订阅减少不必要 re-render；TECH_DESIGN 早已规划                    |
| 2026-05-12 | 协议保留 `forceBackend`（init 消息）                | 仅看自动 detect                                              | 让 /dev/perf 能对照 WebGPU vs WASM；也方便排查降级路径                                     |

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

### 基线 1 · macOS Apple Silicon · Chromium 148 headless (`pnpm start`)

| 后端   | init (ms) | first pass (ms) | mean (ms) | P50 (ms) | P95 (ms) | min (ms) |
| ------ | --------- | --------------- | --------- | -------- | -------- | -------- |
| WebGPU | 2007.7    | 1408.7          | 1208.1    | 1163.3   | 1408.7   | 1136.4   |
| WASM   | 2075.4    | 1047.9          | 991.1     | 976.5    | 1047.9   | 971.8    |

> 备注：headless Chromium 的 WebGPU 走 ANGLE→Metal，开销显著；INT8 量化模型在 WASM SIMD 上反而更稳。真机 Chrome / Safari WebGPU 应快 2-3 倍，待真机回填。

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

## 7. 风险与缓解（同步自 PRD §12）

| 风险                      | 状态   | 缓解策略                                                                                                                   | 负责人 |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| MODNet 商用 license       | 待跟进 | 上线前确认；备选 U²-Netp                                                                                                   | TBD    |
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

| 日期       | 版本 | 变更摘要                                                                     |
| ---------- | ---- | ---------------------------------------------------------------------------- |
| 2026-05-11 | 0.1  | 初稿创建                                                                     |
| 2026-05-11 | 0.2  | 确定产品名 Pixfit + 域名 pix-fit.com + 品牌主色 emerald；Q1/Q6/Q7 标记已解决 |

---

> 文档结束。如需查看产品需求，请见 [PRD.md](./PRD.md)；如需查看技术设计，请见 [TECH_DESIGN.md](./TECH_DESIGN.md)。

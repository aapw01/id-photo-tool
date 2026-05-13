# Pixfit · 跨里程碑 TODO

> 这是一个活跃的 TODO 看板，跟踪「已知但当前里程碑不阻塞」的事项。
> 每个里程碑结束 / 重大决策变更时更新本文。
> 完成后用 `[x]` 标记并加完成日期，便于追溯。

---

## 1. 仍需手动操作的环境配置（一次性）

这些动作需要登录控制台或在用户机器执行，AI 助手无法代劳，**不阻塞功能开发**，但部署上线前必须完成。

### 1.1 Cloudflare 接入

- [ ] **Cloudflare Dashboard 连接 GitHub 仓库**
  - 路径：`Workers & Pages` → `Create` → `Workers` → `Connect to Git`
  - Build command：`pnpm install && pnpm cf:build`
  - Deploy command：`pnpm exec wrangler deploy`
  - Production branch：`main`
  - Node 版本：自动读取 `.nvmrc`
  - 详细步骤：[`DEPLOYMENT.md §2.1`](./DEPLOYMENT.md)

- [ ] **绑定自定义域名 `pix-fit.com` + Universal SSL**
  - 路径：Worker 详情 → `Settings` → `Triggers` → `Custom Domains` → `Add Custom Domain`
  - 同时配置 `www.pix-fit.com`（CNAME 到主域）
  - 详细步骤：[`DEPLOYMENT.md §2.2`](./DEPLOYMENT.md)

- [x] ~~GitHub Actions 部署 secrets~~（已撤销）
  - 部署链路改为由 Cloudflare 自身的 Git 集成处理，仓库里不再需要保管
    Cloudflare 凭证；`deploy.yml` 已删除。详见 [`DEPLOYMENT.md §3`](./DEPLOYMENT.md)。

- [ ] **缓解 Workers Free 套餐冷启动 CPU 超限**（治标，不治本）
  - 背景：OpenNext 适配 Next.js 后产出的 `handler.mjs` 约 3.7 MB，其中
    ~1.65 MB 是 Next/React 框架 runtime（不可砍）。Cloudflare Workers
    **Free** 套餐每请求 CPU 上限 10 ms，**包含 isolate 冷启动 evaluate
    JS 的时间**——3.7 MB minified JS 在 V8 上 evaluate 至少 30–80 ms，
    必然触发 `Exceeded CPU Limit` (Error 1102)。这是套餐物理约束，无法
    在代码层完全消除。
  - 已做的代码缓解（合计 -1.6 MB / -30%）：删除 `@vercel/og`、
    `StudioWorkspace` / `SpecManagerShell` 改 `dynamic({ ssr: false })`、
    `[locale]/layout` 的 `<NextIntlClientProvider>` 走 static-imported
    messages、降级到 Next 15.5.18 摆脱 Turbopack handler bug。
  - 已加 `wrangler.jsonc` 的 `placement: { mode: "smart" }` —— 让
    Cloudflare 把 isolate 路由到稳定 datacenter，**减少**冷启动率（但不
    消除）。
  - **建议接入第三方 uptime monitoring 保活**：用 UptimeRobot / Better
    Uptime / Cron-job.org 等免费服务，每 3–5 分钟从多个地区 ping
    `https://pix-fit.com/`，把热门 isolate 保持在 active 状态。覆盖
    至少：US-East、US-West、EU、Asia-East（CF 主要 PoP）。
  - **彻底解决路径**：
    1. **升 Workers Paid Plan**（$5/月）— CPU 限制 50 ms，问题完全消失，
       零代码改动。性价比最高。
    2. **迁 Vercel Hobby**（免费）— Next.js 原生运行时，无 isolate
       evaluate 模型，无此 CPU 限制。代价：国内访问体感比 CF Anycast 慢
       30–60%。
  - 触发器：日 PV 上千或单日 `Exceeded CPU Limit` 计数 ≥ 100 次时立即
    切换到上述路径之一。

- [ ] **重新升级 Next.js 到 16.x**（当前固定在 15.5.18）
  - 背景：OpenNext 1.19.8/1.19.9 + Next 16.2.x 组合存在已知 bug
    ([opennextjs/opennextjs-cloudflare#1258](https://github.com/opennextjs/opennextjs-cloudflare/issues/1258))：
    Next 16.2 默认走 Turbopack，输出的 `page.js` 末尾把 `handler` named export
    放在 child module，OpenNext 的请求管线读 `components.ComponentMod.handler`
    时拿到 `undefined`，所有 app-router 路由在 Workers 上报
    `TypeError: components.ComponentMod.handler is not a function`。
  - PR [#1262](https://github.com/opennextjs/opennextjs-cloudflare/pull/1262)
    给出了一个 `patchPageExports` 的修复方案，但作者最终把 PR closed 没合并，
    上游仍未官方修复。
  - 当前策略：降到 `next@15.5.18` + `eslint-config-next@15.5.18`
    （仍是 OpenNext 1.19.9 官方支持的版本之一），换回 webpack 输出，
    `module.exports = c` 直接暴露 `handler`，CF Workers 正常工作。
  - 升回条件：(1) OpenNext 合并 Turbopack handler delegation 修复；
    或 (2) Next 16 引入对 OpenNext 友好的 app-page chunk shape。
  - 触发器：定期检查 OpenNext changelog 是否提到 "turbopack handler"
    / "app-page exports" / issue #1258 / PR #1262。

### 1.2 真实部署后的验证

- [ ] **Lighthouse 跑分（生产环境）**
  - 工具：Chrome DevTools Lighthouse 面板，或 `pnpm dlx lighthouse https://pix-fit.com/zh-Hans --preset=desktop --output=html`
  - 目标：Performance ≥ 90、Accessibility ≥ 95、Best Practices ≥ 95、SEO ≥ 95
  - 回填到 [`PLAN.md §3.2 M1`](./PLAN.md) 验收表
  - 关于 Lighthouse 是什么、为什么用，见对话记录或 Google 官方文档

- [ ] **Cloudflare Web Analytics 接入**（可选，M5/M8 也可补）
  - 创建 site → 复制脚本片段 → 在 `[locale]/layout.tsx` 注入或走边缘注入
  - cookie-less，不需要 token 字符串放在代码里

### 1.3 M2 / M3 / M4 / M5 / M6 真机回填（兼容性矩阵 + 性能基准）

> AI 已经在 macOS headless Chromium 148 跑通：
>
> - **M2 抠图**：WebGPU + WASM 双后端
> - **M3 换背景**：背景切换 P50 8.3 ms / P95 9.1 ms
> - **M4 智能裁剪**：单测 28 个全过；MediaPipe + auto-center 算法验证
> - **M5 导出 + 压缩**：4 格式 / Pica resample / compress-to-KB 单测全过
> - **M6 相纸 + 排版**：auto-grid / pack-mixed / render-layout / jsPDF 单测全过
>
> 其它真机需要你打开浏览器跑一次。
>
> M4 / M5 / M6 没有独立的 `/dev/*-perf` 基准（导出 / 排版基本不卡，无需 micro-bench）。
> 真机验证：上传一张证件照，选 "美国签证" 规格，确认：
>
> 1. 裁剪框出现且锁定 51:51 比例
> 2. 头部自动居中
> 3. 推荐白底自动套上（toast 提示）
> 4. 拖动裁剪框时，眼线偏离会出现警告条
> 5. 切到 Export tab，文件名应该是 `us-visa_600x600_YYYYMMDD.png`，分辨率正好 600×600
> 6. （M5）选 "公务员考试" → Export tab → 勾 "compress to KB"，目标 25 KB → 下载 JPG，本地 `ls -l` 看大小落在 21–30 KB
> 7. （M5）选 PNG transparent 格式 → 复制到剪贴板 → 在系统图像编辑器（macOS 预览 / Win Paint）粘贴，背景应该是透明
> 8. （M6）切到 Layout tab → 选 6R 相纸 → 选 "8 张 2 寸" 模板 → 下载 PNG，文件名应该是 `layout_8x2inch-on-6R_6R_YYYYMMDD.png`
> 9. （M6）同一个 layout 下载 PDF → 在 Acrobat / Preview 打开，确认 cell 边缘是矢量分隔线（zoom 4× 仍清晰）
> 10. （M6）切到 "Custom mix"，自定义 4 张 1 寸 + 2 张 2 寸 → 看 LayoutPreview 实时更新；overflow 横幅在数量超出时出现

启动方式：

```bash
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm build && \
NEXT_PUBLIC_ENABLE_DEV_PAGES=1 pnpm start

# 抠图基准
# 浏览器打开 http://localhost:3000/en/dev/perf
# 1) 点 "Use a 512×768 synthetic photo"（或上传一张真人像）
# 2) 点 "Run benchmark"
# 3) 点 "Copy JSON" → 粘贴给我，我会回填 PLAN §6.5 / §6.6

# 背景切换基准（M3）
# 浏览器打开 http://localhost:3000/en/dev/bg-perf
# 1) 默认 60 次迭代即可
# 2) 点 "Run swap benchmark"
# 3) 点 "Copy JSON" → 粘贴给我，我回填 PLAN §6.7
```

待跑环境（两个基准都跑一遍）：

- [ ] macOS Chrome（桌面、有 GUI）
- [ ] macOS Safari 17+（验证 WebGPU 是否可用）
- [ ] iOS Safari 17+（手机真机）
- [ ] Android Chrome（手机真机）
- [ ] Windows / Linux Chrome（如果有的话）

---

## 2. M1 阶段遗留待优化项（不阻塞 M2）

- [ ] **首屏 JS bundle 优化**
  - 当前：~218 KB gzipped（React 19 + Next 16 + next-intl + radix-ui + sonner）
  - 目标：150 KB（M1 DoD）
  - 优化点：
    - radix-ui 改用按需子包（如 `@radix-ui/react-dialog`）而非整个 `radix-ui` umbrella
    - LanguageSwitcher 改为按需加载（首页不需要立即显示）
    - 评估 `sonner` 是否在首页需要（首页没有 toast，可移出 root layout）
  - 计入：**M8 · SEO + 移动端 + 打磨**

- [ ] **Inter 字体策略升级**
  - 现状：`next/font/google` 自动自托管
  - 可选：迁移到手动 `.woff2` + `next/font/local`，更明确的 subset 控制（`latin-ext` 是否需要）
  - 触发条件：M5 上线后观察 LCP 表现，决定是否优化

- [ ] **暗色模式**
  - 目前 light only（V1 范围）
  - 计入 V1.1，可在 M8 末期评估

---

## 3. M2 · 抠图核心（in progress）

> 详细任务清单见 [`tasks/M2.md`](./tasks/M2.md)（20 个原子任务）。
> 本节只跟踪「跨小组的高层进度」，每个 task 的状态以 `tasks/M2.md §6` 进度表为准。

- [x] 撰写 `docs/tasks/M2.md`（原子任务拆分）— 2026-05-11
- [x] 组 A · 模型资产准备（T01–T03）— 2026-05-12（T03 R2 已规划但延后到 Cloudflare 接入后）
  - [x] T01 脚本默认走 ModelScope 镜像，4 秒下完；SHA-384 已固化 — 2026-05-12
  - [x] T02 integrity 模块 + 4 条断言（含真实模型正向 + 1 字节篡改）— 2026-05-12
  - [ ] T03 R2 / cdn.pix-fit.com — 等 Cloudflare 控制台接入
- [ ] 组 B · 抠图运行时（T05–T11）
  - [x] T05 onnxruntime-web 安装 + WASM 路径策略 — 2026-05-12
  - [x] T06 Worker 协议 + 骨架（stub session，T07–T10 接入真 ort）— 2026-05-12
  - [x] T07 模型加载器 + Cache API 持久化 + 重试 — 2026-05-12
  - [x] T08 预处理：cover-crop → NCHW Float32 张量 — 2026-05-12
  - [x] T09 后处理：mask → 原图分辨率 RGBA + inverse crop — 2026-05-12
  - [x] T10 OrtSession + WebGPU 探测 + WASM 降级 — 2026-05-12
  - [x] T11 错误分类 + 三语文案（16 个 key）— 2026-05-12
- [x] 组 C · React 集成（T12–T14）— 2026-05-12
  - [x] T12 SegmentationClient + useSegmentation hook + 引用计数 — 2026-05-12
  - [x] T13 桌面 idleCallback prewarm + CTA hover trigger — 2026-05-12
  - [x] T14 Toaster + SegmentationFeedback 浮动条 — 2026-05-12
- [x] 组 D · Studio 路由（T15–T17）— 2026-05-12
  - [x] T15 /studio 三语 SSR + 工作台 shell — 2026-05-12
  - [x] T16 zustand 跨页面 store + UploadDropzone 自动跳转 — 2026-05-12
  - [x] T17 Mask 预览（destination-in 合成）+ 透明 PNG 导出 — 2026-05-12
- [x] 组 E · 验证（T18–T20）— 2026-05-12（T20 待真机回填）
  - [x] T18 Worker 单测：worker-router + classifyError 共 7 条 — 2026-05-12
  - [x] T19 /dev/perf 基准工具 + 首批数据落 PLAN §6.5 — 2026-05-12
  - [~] T20 兼容性矩阵骨架（PLAN §6.6）— 仅 Chromium 148 headless 已跑通；待用户在真机跑 Chrome 桌面 / Safari / iOS / Android 一次以回填

**关键里程碑**：

- [x] **首版可演示** — 用户上传一张图，能在 `/studio` 看到 mask 预览（T16+T17 完成）— 2026-05-12
- [x] **达到性能 DoD** — `/dev/perf` headless baseline 已落 PLAN §6.5（T19）— 2026-05-12

参考：[`TECH_DESIGN.md §5.2 抠图模块`](./TECH_DESIGN.md)

---

## 4. M3 · 换底色 ✅（代码完成，真机性能待回填）

> 详细任务清单见 [`tasks/M3.md`](./tasks/M3.md)（10 个原子任务）。

- [x] 组 A · 合成内核 — `composite()` + foreground 缓存 + zustand store（16+10 单测）— 2026-05-12
- [x] 组 B · 背景面板 — ColorSwatch / BackgroundPanel / BeforeAfterSlider — 2026-05-12
- [x] 组 C · Studio 集成 + 导出 — Tab 切换 + 接入合成 + PNG/JPG/Copy 三种导出 — 2026-05-12
- [x] 组 D · 验证 — `/dev/bg-perf` baseline P50 8.3ms / P95 9.1ms — 2026-05-12
- [~] 真机性能回填（见 §1.3）

**性能验证**：headless 已远超目标（P50 9 ms vs 30 ms 目标 ≈ 1/3 余量；P95 9 ms vs 50 ms ≈ 1/5）。

参考：[`tasks/M3.md`](./tasks/M3.md) · [`PLAN.md §6.7`](./PLAN.md)

---

## 5. M4 · 照片规格 + 智能裁剪 ✅（代码完成，真机验证待回填）

> 详细任务清单见 [`tasks/M4.md`](./tasks/M4.md)（15 个原子任务）。

- [x] 组 A · 数据模型 — `types/spec.ts` zod schema + `lib/spec-units.ts` mm↔px helper + 28 条 PhotoSpec + 7 条 PaperSpec（21 单测）— 2026-05-12
- [x] 组 B · 算法 + 人脸 — MediaPipe lazy loader + face-detect wrapper + autoCenter + compliance（28 单测）— 2026-05-12
- [x] 组 C · UI — Spec store + SpecPicker + CropFrameOverlay + Guidelines + ComplianceBanner — 2026-05-12
- [x] 组 D · Studio 集成 — size tab 解锁 + useCropFlow 串联 + background 推荐自动套用 + 导出文件名 `{spec.id}_*` — 2026-05-12
- [x] 组 E · 验证 — `pnpm lint / typecheck / test (165) / build` 全绿；三语 /studio 200 — 2026-05-12
- [~] 真机端到端验证（见 §1.3）

**关键决策**（同步至 PLAN §6 决策日志）：

- 人脸检测用 MediaPipe Tasks Vision（vs faceapi.js）
- WASM 走 jsdelivr，模型走 GCS；保留 `NEXT_PUBLIC_FACE_MODEL_URL` 切换口子
- CropFrame 自研 250 行，没引第三方裁剪库
- spec.background.recommended 第一次访问自动套用（不覆盖用户改过的背景）

参考：[`tasks/M4.md`](./tasks/M4.md) · [`PLAN.md §3.2 M4`](./PLAN.md)

---

## 6. M5 · 导出 + 压缩 ✅（代码完成，真机验证待回填）

> 详细任务清单见 [`tasks/M5.md`](./tasks/M5.md)（7 个原子任务）。

- [x] 组 A · 算法模块 — `resample.ts`（Pica）+ `export-single.ts`（4 格式）+ `compress-to-kb.ts`（二分搜索 + 自动下采样）+ `filename.ts`（single / compressed / layout 三类）— 2026-05-12
- [x] 组 B · UI — `export-panel.tsx` 重写（格式单选 / 实时大小估算 / 质量滑块 / KB 输入 / 文件名预览 / 下载 + 复制到剪贴板）— 2026-05-12
- [x] 组 C · 测试矩阵 — 项目总单测 242（M4 时 165）；含 vitest happy-dom canvas / toBlob / createImageBitmap stub — 2026-05-12
- [x] 组 D · 验证 — `pnpm lint / typecheck / test / i18n:check / build` 全绿；三 locale `/studio` 200 — 2026-05-12
- [~] 真机端到端验证（见 §1.3 检查项 6 / 7）

**关键决策**（同步至 PLAN §6 决策日志）：

- Pica vs 自实现 Lanczos：选 Pica。lazy import + native 回退兜底。
- 单次 resample 路径：先 native crop 原分辨率 → Pica 一次性缩到目标，避免双采样。
- happy-dom 测试栈：在 `vitest.setup.ts` 安装 Proxy 形式的 canvas / toBlob stub，缓存 per-canvas context 让 draw call 可断言。

---

## 7. M6 · 相纸 + 排版 ✅（代码完成，真机验证待回填）

> 详细任务清单见 [`tasks/M6.md`](./tasks/M6.md)（12 个原子任务）。

- [x] 组 A · 数据 + 算法 — 12 条 layout 模板 + `auto-grid`（旋转探索）+ `pack-mixed`（混排）+ `render-layout`（HTMLCanvasElement，DPI override）+ `cut-guides` + `export-pdf`（jsPDF lazy）— 2026-05-12
- [x] 组 B · UI 面板 — Layout store + PaperPicker（7 张相纸）+ LayoutTemplatePicker（按 paper 兼容性筛选）+ MixedEditor（custom-mix 不污染内置数据）+ LayoutSettings + LayoutActions（PNG + PDF）— 2026-05-12
- [x] 组 C · Studio 集成 — `studio-tabs.tsx` 解锁 layout tab；`studio-workspace.tsx` 把 `tab === 'layout'` 时主画布替换为 `LayoutPreview`，右侧侧栏换 `LayoutPanel` — 2026-05-12
- [x] 组 D · 验证 + 文档 — 三 locale `Layout.*` / `Paper.*` 全补；i18n:check 161 keys parity；242 单测 + lint + typecheck + build 全绿 — 2026-05-12
- [~] 真机端到端验证（见 §1.3 检查项 8 / 9 / 10）

**关键决策**（同步至 PLAN §6 决策日志）：

- jsPDF vs pdf-lib：选 jsPDF（lazy import 隔离体积；`addImage` API 胶水最少）。
- auto-grid V1 only：保留 `manual.cells` schema 但 UI 暂时只生成 auto-grid 模板。
- layout 内嵌 /studio：单线流程不跳路由；未来批处理再独立 /print。
- DPI override 重算 px：`PaperSpec` 自带 300 DPI 像素，preview 走 150 DPI 时必须丢字段重算。
- `lib/i18n-text.ts` 集中映射 zh-Hans → zh，修复 M4 PhotoSpec 名字在简中环境永远落到英文的 latent bug。

---

## 8. M7 · 规格管理 ✅（代码完成，真机端到端待回填）

> 详细任务清单见 [`tasks/M7.md`](./tasks/M7.md)（11 个原子任务）。
> 与 M5+M6 并行落地，模块边界清晰、依赖少（只读 BUILTIN_PHOTO_SPECS / BUILTIN_PAPER_SPECS）。

- [x] 组 A · 数据层 — `schema / storage / merge / crud / dependency-check / import-export` 六个纯模块 — 2026-05-12
- [x] 组 B · 单测 — 50 个新单测，覆盖 5 模块的容错路径（合并后总测 ≈ 292）— 2026-05-12
- [x] 组 C · UI — `store.ts` zustand + `photo-spec-form` / `paper-spec-form` + `spec-manager-shell` — 2026-05-12
- [x] 组 D · 入口 + i18n — `/specs` 三语 SSG + Footer 入口 + `SpecManager.*` 三语完全对齐 — 2026-05-12
- [x] 组 E · 验证 — `pnpm lint / typecheck / test / i18n:check / build` 全绿；三语 /specs curl 200 — 2026-05-12
- [~] 真机端到端验证（待用户回填到 §1.3）：
  - 创建一条自定义照片规格 → 关闭浏览器 → 重开应仍存在
  - Export JSON → 清浏览器存储 → Import JSON → 列表完整恢复
  - 复制 builtin "美国签证" → 编辑名称 → 在 /studio 的 spec-picker 看到副本

**关键决策**（同步至 PLAN §6 决策日志）：

- localStorage key 采用 `pixfit:specs:v1`（与新品牌一致）
- `saveSpecs()` 在持久化边界再过一次 zod，作为多入口（CRUD / replaceAll / 导入）的统一兜底
- 用户同 id 项整体覆盖 builtin，`builtin: false` 一并写入；删除保护只看 `builtin` 标志

**导入策略说明**：当前 `replaceAll` 直接覆盖用户自定义集合（不做 diff 合并）。M7 的简化实现：用户角度"导出 → 导入"是完整快照，等同于备份恢复。M8 打磨阶段可以再加 diff UI。

参考：[`tasks/M7.md`](./tasks/M7.md) · [`PLAN.md §3.2 M7`](./PLAN.md)

---

## 9. M8+ 长期事项收集池

收到反馈、读 PRD/TECH_DESIGN 时发现但尚未排期的小事，丢到这里，到对应里程碑再消化。

### M8 已完成（M8a SEO + 路由 / M8b 移动 + 打磨）

#### M8a · SEO + 路由

- [x] **隐私政策与服务条款页面** — `/privacy` `/terms` 三语 SSG，Footer/Header 联动
- [x] **`/sizes` `/paper` `/templates` 列表页** — 三 SEO 着陆页 + JSON-LD ItemList
- [x] **sitemap.xml + robots.txt** — 24 条 hreflang URL，`/dev/` 屏蔽
- [x] **三语 namespace 同步** — Sizes / Paper.list / Templates / Legal / Errors / Studio.mobile / Nav.menu / Footer groups / Export.wechatHint

#### M8b · 移动 + 打磨

- [x] **`/studio?tab=export` 等 deeplink** — `parseTabParam` 4 单测 + `useTabDeeplink` hook；`router.replace` 不推历史栈
- [x] **Studio 移动端布局** — `StudioBottomTabs` fixed 底部 nav + `<Sheet side="bottom">` 承载 BackgroundPanel / SpecPicker / LayoutPanel / ExportPanel
- [x] **CropFrame 触摸把手 ≥ 44×44** — `size-11` 隐形 hit area + `::before` 视觉小点；`touch-action: none`；`@media(pointer:coarse)` 视觉 +4px
- [x] **ExportPanel 微信浏览器长按提示** — `isWeChatBrowser` UA 检测（4 单测）+ `useIsWeChat` hook + 三语 hint
- [x] **404 / error 页** — `[locale]/not-found.tsx` + `[locale]/error.tsx` 客户端 boundary + 顶级 `app/not-found.tsx` emerald 兜底
- [x] **Lighthouse 构建包基线** — `.next` 32 KB Brotli 前 2.3 MB / 34 chunks / 38 prerendered HTML；§6.8 已回填；真机 PageSpeed Insights [user-pending]

### V1.1（M8 主动延后）

- [ ] **历史会话 IndexedDB**（V1.1）— PRD §5.9 写「页面关闭即清空」，IndexedDB 与该约束矛盾，留 V1.1 重新设计
- [ ] **撤销 / 重做（zundo）**（V1.1）— 涉及 background / crop / layout 三 store 中间件改造，M8 时间盒不动
- [ ] **`/sizes/[id]` `/paper/[id]` `/templates/[id]` 详情页**（V1.1）— 列表页 + ItemList 已能让爬虫覆盖 47 条 spec id；141 张三语文案维护成本高，等真自然流量再决定
- [ ] **HSV / 渐变背景**（V1.1，扩 BackgroundPanel）— 当前只支持 HEX，已足够 V1
- [ ] **CropFrame 8 把手（含边把手）**（V1.1）— 当前只 4 个角，多数场景已足够
- [ ] **face-detect 性能基准**（V1.1）— 目前仅依赖单测，没单独 `/dev/face-perf` 路由
- [ ] **MediaPipe 模型 SHA 校验**（V1.1，等 R2 接入再上）
- [ ] **混排单元图片改用 face-detect frame**（V1.1）— M6 兜底用 `centerCrop`，未来可对每个 spec 跑一次 face-detect 复用 frame
- [ ] **PDF 单测**（V1.1）— 当前 jsPDF 走 happy-dom 不便测，留到能跑 jsdom 浏览器集成时补
- [ ] **Layout `manual.cells` UI**（V1.1）— schema 已经预留，做一个像素级拖拽编辑器

---

## 维护规范

- 修改本文档时，连同 `PLAN.md` 的「最近更新」一起改时间戳，便于回溯
- 完成项保留 ≥ 2 个里程碑，方便回看；过老的归档到 PLAN.md §6 决策日志
- 增加新事项时分类到上面四节中最合适的一节；不要直接加到末尾

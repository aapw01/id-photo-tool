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

- [ ] **（可选）GitHub Actions secrets**
  - 当前如果用 Cloudflare 控制台 Git 集成，这一步可以跳过
  - 后续切换到 Actions 部署再加：`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

### 1.2 真实部署后的验证

- [ ] **Lighthouse 跑分（生产环境）**
  - 工具：Chrome DevTools Lighthouse 面板，或 `pnpm dlx lighthouse https://pix-fit.com/zh-Hans --preset=desktop --output=html`
  - 目标：Performance ≥ 90、Accessibility ≥ 95、Best Practices ≥ 95、SEO ≥ 95
  - 回填到 [`PLAN.md §3.2 M1`](./PLAN.md) 验收表
  - 关于 Lighthouse 是什么、为什么用，见对话记录或 Google 官方文档

- [ ] **Cloudflare Web Analytics 接入**（可选，M5/M8 也可补）
  - 创建 site → 复制脚本片段 → 在 `[locale]/layout.tsx` 注入或走边缘注入
  - cookie-less，不需要 token 字符串放在代码里

### 1.3 M2 / M3 / M4 真机回填（兼容性矩阵 + 性能基准）

> AI 已经在 macOS headless Chromium 148 跑通：
>
> - **M2 抠图**：WebGPU + WASM 双后端
> - **M3 换背景**：背景切换 P50 8.3 ms / P95 9.1 ms
> - **M4 智能裁剪**：单测 28 个全过；MediaPipe + auto-center 算法验证
>
> 其它真机需要你打开浏览器跑一次。
>
> M4 没有独立的 `/dev/*-perf` 基准（人脸检测一次 ~50–150 ms 取决于设备，无需 micro-bench）。
> 真机验证：上传一张证件照，选 "美国签证" 规格，确认：
>
> 1. 裁剪框出现且锁定 51:51 比例
> 2. 头部自动居中
> 3. 推荐白底自动套上（toast 提示）
> 4. 拖动裁剪框时，眼线偏离会出现警告条
> 5. 切到 Export tab，文件名应该是 `us-visa_600x600_YYYYMMDD.png`，分辨率正好 600×600

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

## 6. M7 · 规格管理 ✅（代码完成，真机端到端待回填）

> 详细任务清单见 [`tasks/M7.md`](./tasks/M7.md)（11 个原子任务）。
> M5 / M6 是另一位 agent 负责的并行里程碑，M7 提前完成是因为模块边界清晰、依赖少（只读 BUILTIN_PHOTO_SPECS / BUILTIN_PAPER_SPECS）。

- [x] 组 A · 数据层 — `schema / storage / merge / crud / dependency-check / import-export` 六个纯模块 — 2026-05-12
- [x] 组 B · 单测 — 50 个新单测，覆盖 5 模块的容错路径（总测 165 → 215）— 2026-05-12
- [x] 组 C · UI — `store.ts` zustand + `photo-spec-form` / `paper-spec-form` + `spec-manager-shell` — 2026-05-12
- [x] 组 D · 入口 + i18n — `/specs` 三语 SSG + Footer 入口 + 三语 190 keys 完全对齐 — 2026-05-12
- [x] 组 E · 验证 — `pnpm lint / typecheck / test (215) / i18n:check / build` 全绿；三语 /specs curl 200 — 2026-05-12
- [~] 真机端到端验证（待用户回填到 §1.3）：
  - 创建一条自定义照片规格 → 关闭浏览器 → 重开应仍存在
  - Export JSON → 清浏览器存储 → Import JSON → 列表完整恢复
  - 复制 builtin "美国签证" → 编辑名称 → 在 /studio 的 spec-picker 看到副本

**关键决策**（同步至 PLAN §6 决策日志）：

- localStorage key 采用 `pixfit:specs:v1`（替代 PRD §9.4.1 草案里的 `id-photo-tool:specs:v1`，与新品牌一致）
- `saveSpecs()` 在持久化边界再过一次 zod，作为多入口（CRUD / replaceAll / 导入）的统一兜底
- 用户同 id 项整体覆盖 builtin，`builtin: false` 一并写入；删除保护只看 `builtin` 标志

**导入策略说明**：当前 `replaceAll` 直接覆盖用户自定义集合（不做 diff 合并）。这是 M7 的简化实现：用户角度"导出 → 导入"是完整快照，等同于备份恢复。M8 打磨阶段可以再加 diff UI（"将导入 X 条；其中 Y 条覆盖现有"）。

参考：[`tasks/M7.md`](./tasks/M7.md) · [`PLAN.md §3.2 M7`](./PLAN.md)

---

## 7. M5+ 长期事项收集池

收到反馈、读 PRD/TECH_DESIGN 时发现但尚未排期的小事，丢到这里，到对应里程碑再消化。

- [ ] **隐私政策与服务条款页面**（M5 或 M8）
  - 当前 Footer 已经有 `/privacy` `/terms` 链接但还没路由，需要 404 兜底或软删除
- [ ] **`/sizes` `/paper` `/templates` 列表页**（M5/M6/M7）
- [ ] **历史会话**（M5 后期，IndexedDB）
- [ ] **HSV / 渐变背景**（V1.1，扩 BackgroundPanel）— 当前只支持 HEX，已足够 V1
- [ ] **撤销 / 重做**（PRD §5.9 历史会话，M5 期）— 背景色切换历史走 zundo
- [ ] **`/studio?tab=export` 等 deeplink**（M5/M8）— 目前 tab 状态只在内存，不写 URL
- [ ] **CropFrame 8 把手（含边把手）**（V1.1）— 当前只 4 个角，多数场景已足够
- [ ] **Pica 重采样接入**（M5）— 替换当前 `drawImage` 高质量缩放
- [ ] **face-detect 性能基准**（M8 打磨期）— 目前仅依赖单测，没单独 `/dev/face-perf` 路由
- [ ] **MediaPipe 模型 SHA 校验**（M2-T03 同期，等 R2 接入再上）

---

## 维护规范

- 修改本文档时，连同 `PLAN.md` 的「最近更新」一起改时间戳，便于回溯
- 完成项保留 ≥ 2 个里程碑，方便回看；过老的归档到 PLAN.md §6 决策日志
- 增加新事项时分类到上面四节中最合适的一节；不要直接加到末尾

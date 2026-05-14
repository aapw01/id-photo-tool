# 项目计划与里程碑 — Pixfit Scanner

> 本文档是 Scanner 子产品的活看板：里程碑进度、未决问题、技术决策。
> 母产品计划见 [../PLAN.md](../PLAN.md)。需求见 [./PRD.md](./PRD.md)。

---

## 1. 当前状态摘要

| 项         | 值                                                                              |
| ---------- | ------------------------------------------------------------------------------- |
| 子产品名   | **Pixfit Scanner** · 中文「证件扫描生成器」                                     |
| 路由前缀   | `/[locale]/scanner`                                                             |
| 当前阶段   | **S8 · 历史 + ToS + a11y + 上线清单**（已完成）                                 |
| 项目阶段   | S1–S8 全部合并 · 可上线                                                         |
| 最近更新   | 2026-05-14                                                                      |
| 一句话进度 | 核心流程（上传 → 校正 → 输出模式 → 水印 → A4/Letter/A5 导出 PDF/PNG）端到端可用 |

---

## 2. 文档索引

| 文档               | 路径                                   | 状态                |
| ------------------ | -------------------------------------- | ------------------- |
| 产品需求文档       | [PRD.md](./PRD.md)                     | v0.1 Draft          |
| 执行计划（本文档） | [PLAN.md](./PLAN.md)                   | v0.1 Draft          |
| S1 任务清单        | [tasks/S1.md](./tasks/S1.md)           | 未创建（S1 启动时） |
| S2–S8 任务清单     | [tasks/](./tasks/)                     | 未创建              |
| 母产品 PRD         | [../PRD.md](../PRD.md)                 | v0.2 Draft          |
| 母产品 PLAN        | [../PLAN.md](../PLAN.md)               | v0.3 Draft          |
| 母产品 TECH_DESIGN | [../TECH_DESIGN.md](../TECH_DESIGN.md) | v0.2 Draft          |
| 母产品 DESIGN      | [../DESIGN.md](../DESIGN.md)           | v0.1 Draft（沿用）  |

---

## 3. 里程碑跟踪

### 3.1 总览

| 里程碑 | 主题                           | 状态      | 预估 | 任务清单    |
| ------ | ------------------------------ | --------- | ---- | ----------- |
| S1     | 路由 + 导航 + 骨架             | ✅ 已合并 | 3 天 | tasks/S1.md |
| S2     | 上传 + EXIF + HEIC             | ✅ 已合并 | 2 天 | tasks/S2.md |
| S3     | OpenCV.js + 透视校正           | ✅ 已合并 | 4 天 | tasks/S3.md |
| S4     | 输出模式（扫描 / 复印 / 增强） | ✅ 已合并 | 3 天 | tasks/S4.md |
| S5     | 水印 + A4 排版 + PDF           | ✅ 已合并 | 3 天 | tasks/S5.md |
| S6     | 多 DocSpec + 多纸张（A4/L/A5） | ✅ 已合并 | 3 天 | tasks/S6.md |
| S7     | SEO 落地页 + JSON-LD           | ✅ 已合并 | 3 天 | tasks/S7.md |
| S8     | 历史 / ToS / a11y / 上线       | ✅ 已合并 | 3 天 | tasks/S8.md |

**预计总工期**：~24 工作日 ≈ **4–5 周**（单人节奏）

### 3.2 里程碑详细交付物

#### S1 · 路由 + 导航 + 骨架（3 天）

**目标**：用户可以访问 `/[locale]/scanner` 看到一个**空骨架**页（不报错、有占位 UI、Header「工具 ▾」下拉能跳转、三语切换正常、主产品文档已同步引用 Scanner）。

**交付物清单**（原子任务，10 个）：

- [ ] **S1-T01**：创建 `src/app/[locale]/scanner/page.tsx` 路由（Server Component，SSR）+ `loading.tsx` + `metadata`
- [ ] **S1-T02**：创建 `src/features/scanner/` 模块目录，分层 `components/` `store/` `lib/` `model/`
- [ ] **S1-T03**：写 `src/features/scanner/store/scanner-store.ts`（Zustand），独立于 `studio-store`
- [ ] **S1-T04**：i18n namespace `Scanner.*`：在 `zh-Hans` / `zh-Hant` / `en` 各写 30+ 个 placeholder key，跑 `pnpm i18n:check` 验证一致性
- [ ] **S1-T05**：改 `src/components/site-header.tsx` 把 Studio 单链改成「工具 ▾」下拉（NavigationMenu），含 Studio / 证件扫描生成器 / 规格库 / 排版打印 四项
- [ ] **S1-T06**：改 `src/components/site-mobile-nav.tsx` —— **按 Q7 决策**把扫描入口**归并到「工具」二级菜单**（点底部"工具"图标打开 sheet/popover 列出全部工具项），而非加第 5 个 tab
- [ ] **S1-T07**：写 `src/features/scanner/components/scanner-shell.tsx` 骨架（左上传区 / 中预览占位 / 右配置面板）
- [ ] **S1-T08**：把 `<ScannerShell />` 用 `dynamic({ ssr: false })` 懒加载到 `/scanner` 页面（同 Studio 模式），减少 SSR 负担
- [ ] **S1-T09**：**同步主产品文档**——按 Q10 决策更新 `docs/PLAN.md`（加 Scanner 子产品入口）+ `README.md`（在路由表 / 文档索引里加证件扫描生成器）+ `docs/PRD.md`（在 §13 V2+ 路线图标注 Scanner 已成独立子产品，不再算 V2 项）
- [ ] **S1-T10**：在 `src/i18n/messages/*.json` 加 `Nav.tools.*` 键（"工具" 下拉的菜单项文案三语对齐）

**验收**：

- `pnpm dev` 访问 `/zh-Hans/scanner` / `/zh-Hant/scanner` / `/en/scanner` 三语骨架页正常
- Header「工具 ▾」下拉所有目标可达；移动端「工具」二级 sheet 列出全部工具项
- `pnpm typecheck` / `lint` / `test` / `i18n:check` 全绿
- 现有 Studio / Specs / Paper / Templates 测试 0 回归
- `docs/PLAN.md` 顶部表格出现 Scanner 子产品状态行；`README.md` 路由表含 `/scanner`

---

#### S2 · 上传 + EXIF + HEIC（2 天）

**目标**：双面上传组件可用，EXIF 旋转修正 + HEIC → JPG 懒加载 + 大文件预压缩。

**交付物**（预计 6 个原子任务）：

- [ ] **S2-T01**：`scanner-upload-zone.tsx` 双 dropzone（front / back）组件，含拖拽 / 点击 / 粘贴 / 摄像头四种入口
- [ ] **S2-T02**：复用 `src/lib/image/` 已有的 EXIF orientation 修正 / HEIC 解码（不要重写，直接 import）
- [ ] **S2-T03**：单面模式开关（hasBack toggle）
- [ ] **S2-T04**：预压缩：长边 > 4000px → 降到 4000（防 OpenCV 爆内存）
- [ ] **S2-T05**：内置示例图（3 张模糊掉个人信息的演示证件，放 `public/scanner-samples/`）
- [ ] **S2-T06**：单元测试：EXIF / HEIC / 拒绝非图像 MIME

---

#### S3 · OpenCV.js + 透视校正（4 天）

**目标**：上传后能自动检测四角并校正；失败时进入手动 4 角拖拽模式。

**交付物**（预计 10 个原子任务）：

- [ ] **S3-T01**：选定 OpenCV.js 版本（`opencv.js@4.10.0` 或更稳定 LTS），自托管到 `public/_vendor/opencv/opencv.js`
- [ ] **S3-T02**：写 `src/features/scanner/lib/opencv-loader.ts`，从静态路径懒加载 wasm，缓存到 IndexedDB（首次 < 3.5s @ 4G）
- [ ] **S3-T03**：用 Web Worker 跑 OpenCV（不阻塞主线程），消息协议化
- [ ] **S3-T04**：写 `perspective-detect.ts`：Canny + findContours + 最大四边形选择算法
- [ ] **S3-T05**：写 `perspective-warp.ts`：`getPerspectiveTransform` + `warpPerspective`
- [ ] **S3-T06**：写 `corner-handles.tsx` 4 角拖拽组件（Pointer Events，支持键盘 ±1px / Shift ±10px）
- [ ] **S3-T07**：自动检测失败的 fallback UX（toast 提示 + 自动切到手动）
- [ ] **S3-T08**：Worker → 主线程消息：进度（detect → warp → done）
- [ ] **S3-T09**：单元测试：纯算法部分 mock OpenCV 接口
- [ ] **S3-T10**：性能 benchmark `dev/scanner-perf` 页面，对照 PRD §3.3 目标

---

#### S4 · 输出模式 + 实时预览（3 天）

**目标**：用户切换扫描件 / 复印件 / 照片增强，预览实时更新。

**交付物**（预计 7 个原子任务）：

- [ ] **S4-T01**：`output-mode-switcher.tsx` UI（三选一 segmented control）
- [ ] **S4-T02**：`pipeline/scan-effect.ts` 扫描件流水线（white balance + brightness + sharpen）
- [ ] **S4-T03**：`pipeline/copy-effect.ts` 复印件流水线（gray + Otsu + 可选噪声叠加）
- [ ] **S4-T04**：`pipeline/enhance-effect.ts` 照片增强（auto WB + CLAHE）
- [ ] **S4-T05**：预览防抖（200ms）+ Web Worker pipeline 复用 S3 Worker
- [ ] **S4-T06**：单元测试：每个 pipeline fixture-based 像素 diff
- [ ] **S4-T07**：浏览器无 Web Worker / WASM 时的 fallback（主线程版本，性能弱化但能用）

---

#### S5 · 水印 + A4 排版 + PDF 导出（3 天）

**目标**：用户能下载带水印的 A4 PDF，正反面合理排版。

**交付物**（预计 8 个原子任务）：

- [ ] **S5-T01**：`watermark-config-panel.tsx`（文字 / 角度 / 透明度 / 颜色 / 字号 / 平铺），透明度下限 0.10 强制
- [ ] **S5-T02**：`pipeline/watermark.ts` Canvas 渲染水印平铺（45° 倾斜重复）
- [ ] **S5-T03**：`layout/a4-composer.ts` jsPDF mm-based 排版（按 DocSpec 物理尺寸渲染）
- [ ] **S5-T04**：双面布局选择（上下 / 左右 / 横向 A4）
- [ ] **S5-T05**：边距 + 间距控制（mm）
- [ ] **S5-T06**：PDF 导出 → 下载 + clipboard copy fallback
- [ ] **S5-T07**：默认水印模板按 locale 选择（i18n 表）
- [ ] **S5-T08**：法律警示文案（UI + ToS 增补）

---

#### S6 · 多 DocSpec + 多纸张导出（3 天）

**实际交付（已合并）**：内置 11 条 DocSpec、分 5 个 group；导出纸张 A4 / Letter / A5 三选一；
JPG/PNG/ZIP 拆到 V2 路线图（V1 已能 PNG + PDF 同时导出，覆盖 99 % 用户需求）。

**交付物**（7 个原子任务，✅ 全部完成）：

- [x] **S6-T01**：扩充 `src/features/scanner/lib/doc-specs.ts` 至 11 条
      （cn-id-card / hk-id-card / tw-id-card / sg-nric / in-aadhaar /
      us-driver-license / cn-driver-license / cn-vehicle-license /
      passport-bio / a4 / letter），加 `DocSpecGroup` 类型 + `DOC_SPEC_GROUP_ORDER` + `groupDocSpecs(specs?)` helper。
- [x] **S6-T02**：`scanner-config.tsx` 的 `DocSpecPicker` 改用 `<optgroup>` 按
      `DocSpecGroup` 分组（顺序：id-card → driver-license → vehicle-license →
      passport → paper）。
- [x] **S6-T03**：DocSpec 切换后自动重跑 `rectifySide` 重算输出像素尺寸
      （`store.setDocSpecId` 已实现）。
- [x] **S6-T04**：`pack-a4` 重构为 `packSheet(sides, paperSize)`，支持 A4 / Letter / A5；
      保留 `packA4Portrait` 向后兼容别名。
- [x] **S6-T05**：`export-pdf` 重构为 `exportPackedSheetToPdf`，按
      `packed.paperSize` 设 jsPDF format；保留 `exportPackedA4ToPdf` 别名。
- [x] **S6-T06**：`store` 新增 `paperSize: PaperSize` 状态 + `setPaperSize` action；
      `packCurrentSides` 用 `state.paperSize` 喂给 `packSheet`。
- [x] **S6-T07**：`ExportRow` 新增 paper-size segmented radiogroup（a4 / letter / a5）；
      三语 `Scanner.paperSizes.label / a4 / letter / a5` 全齐；
      `doc-specs.test.ts` 补 group 覆盖度断言，新增 `pack-a4.test.ts` /
      `export-pdf.test.ts`（覆盖 3 种纸张画布尺寸 / 空输入 / 单 vs 双面 cursor 推进 /
      jsPDF format 路由 / 标题 metadata 转发）。

---

#### S7 · SEO 落地页 + JSON-LD（3 天）

**实际交付（已合并）**：每条 DocSpec × 3 语 = 33 个静态生成的 SSR 着陆页；主
`/scanner` 页加分组卡片网格 + FAQ；JSON-LD 覆盖 WebApplication / ItemList /
HowTo / FAQ / BreadcrumbList。

**交付物**（8 个原子任务，✅ 全部完成）：

- [x] **S7-T01**：`src/app/[locale]/scanner/[docType]/page.tsx` 动态路由 +
      `generateStaticParams`（11 docSpec × 3 locale = 33 个静态参数），
      不存在的 docType 走 `notFound()`。
- [x] **S7-T02**：`generateMetadata` 用 `Scanner.detail.metaTitle` /
      `metaDescription` + `buildMetadata` 自动落地 hreflang × canonical × OG ×
      Twitter。
- [x] **S7-T03**：HowTo JSON-LD（4 步固定：upload / detect / configure / export，
      totalTime PT2M），三语完全翻译。
- [x] **S7-T04**：FAQ JSON-LD —— 每个 DocSpec 4 条 FAQ
      （free / privacy / watermark / official），都用 `{name}` 插值，i18n 三语。
      主页 `/scanner` 额外有 5 条 scanner 级 FAQ。
- [x] **S7-T05**：BreadcrumbList JSON-LD（Home › Scanner › DocType name）。
- [x] **S7-T06**：`sitemap-entries.ts` 新增 `scannerDocTypeRoutes()`，priority
      0.7，changeFrequency monthly；33 条 URL 全部进 sitemap，hreflang alternates
      自动覆盖。
- [x] **S7-T07**：主 `/scanner` 页加「支持的证件类型」卡片网格（5 个 group），
      每张卡片链接到对应的 DocType 落地页；并加 `ItemList` JSON-LD。
- [x] **S7-T08**：`sitemap-entries.test.ts` 补 4 条新断言（DocType route 数量
      / 含 URL 列表 / hreflang 完整 / 优先级 ≤ sizes route，防止两者顺序错位）。
- [x] **附加**：`scanner-shell.tsx` 加 `?spec=` 深链勾子，从 SEO 落地页 CTA
      点击「Open scanner with X」时自动预选对应 DocSpec。

---

#### S8 · 历史 + ToS + a11y + 上线清单（3 天）

**实际交付（已合并）**：IndexedDB 会话历史（10 条 + 30 天 TTL）、主页底部「使用须知」
折叠区块、4 角键盘可达、README 单列 Scanner 特性。

**交付物**（8 个原子任务，✅ 全部完成）：

- [x] **S8-T01**：`scanner/lib/history-store.ts` 用 `idb-keyval` 写
      IndexedDB key `pixfit:scanner:history:v1`，LRU 10 条 + TTL 30 天 +
      去重（同 docSpec/paper/mode/watermark 不重复入库）。**只保存配置**，
      不保存图像字节（隐私一致性硬约束）。
- [x] **S8-T02**：`scanner-history.tsx` 右栏「最近会话」面板，显示
      DocSpec name / paper / mode / 时间戳，每条带「还原」+「删除」按钮。
      导出成功后自动入库 + 通过 pub-sub 触发 UI 刷新。
- [x] **S8-T03**：S2 / S5 已在 `Scanner.shell` / `Scanner.watermark` 文案
      明示「照片不上传任何服务器」+「水印强制开启」；新增主页底部
      `Scanner.usage` 折叠区块四点（local / watermark / lawful / accuracy）+
      链接到 `/terms`。
- [x] **S8-T04**：服务条款 §responsibility 已禁止伪造 / 冒用证件（S1 已固化）；
      Scanner usage notice 再次强调。
- [x] **S8-T05**：`scanner-corner-editor.tsx` 4 角 `<circle>` 加 `tabIndex=0` +
      `onKeyDown`（方向键 ±1 px / Shift+方向键 ±10 px）+ `aria-valuetext` /
      `aria-valuenow` / 完整 i18n 角点 label（`Scanner.editor.handles.*`）+
      focus-visible 高亮。
- [x] **S8-T06**：上线前清单 review —— `wrangler.jsonc` / `vercel.json` 未动
      （per user constraint），双部署 smoke 检查走 dashboard 部署观察；
      Lighthouse 实测留给真机回归（CI 不强求）。
- [x] **S8-T07**：跑全套 `pnpm typecheck && pnpm test && pnpm lint &&
pnpm format:check && pnpm i18n:check` 全绿（55 文件 / 509 测试 /
      685 i18n keys / locale）。
- [x] **S8-T08**：母 `README.md` 加「Pixfit Scanner · 证件扫描生成器」专章，
      11 行核心特性 + 路由表同步更新 S1–S8 完成状态。

**验收**：访问 `https://pix-fit.com/scanner` 跑完整流程（上传 → 校正 → 输出 → PDF 下载）无回归；Lighthouse 全绿；母 Studio 0 回归。

---

## 4. 决策记录（10 / 10 已敲定）

> 2026-05-14 评审完成，下述决策为 S1 的输入。如未来要推翻，必须先改本表 + 同步 PRD。

| 编号 | 问题                                 | 决策                                                                                         |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Q1   | Scanner 模块中文最终名称             | ✅ **「证件扫描生成器」**                                                                    |
| Q2   | 是否需要独立 Logo？                  | ✅ 不需要。共用主 Pixfit Logo + 子图标 Lucide `ScanLine`                                     |
| Q3   | OpenCV.js 版本                       | ✅ **`opencv.js@4.10.x` LTS**（S3-T01 时锁定具体补丁号）                                     |
| Q4   | OpenCV.js 缓存策略                   | ✅ **Cache Storage**（HTTP 304 友好）；命中率低再加 IndexedDB                                |
| Q5   | 默认水印文案是否法务审稿             | ✅ V1 用通用模板，跑通后请法务过一遍                                                         |
| Q6   | "工具下拉"在 S1 还是 S8 做           | ✅ S1 一次性改 Header + 移动端 nav，不留尾巴                                                 |
| Q7   | 移动端 5 个 tab 太挤怎么处理         | ✅ **归并到「工具」二级菜单**（点 Header「工具」展开 popover/sheet，含 Studio + Scanner 等） |
| Q8   | 印章功能是否做                       | ✅ V1 **不做完整印章库**，仅允许"上传自己的印章 PNG"。法律风险压制                           |
| Q9   | OCR 字段提取                         | ✅ V1 不做，进 V2 路线图                                                                     |
| Q10  | 主 `PLAN.md` 是否同步加 Scanner 入口 | ✅ **S1 启动时一并改**（任务清单已加 S1-T09）                                                |

---

## 5. 关键决策记录

| 日期       | 决策                                                                              | 理由                                               |
| ---------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| 2026-05-14 | Scanner 与 Studio **严格代码层解耦**：独立路由 / 独立 store / 独立 i18n namespace | 防止互相污染；以后任一模块可单独迭代或下线         |
| 2026-05-14 | 水印 **强制开启，不可完全关闭**（透明度下限 0.10）                                | 道德 / 法律兜底，防伪造灰产滥用                    |
| 2026-05-14 | V1 **不做完整印章库**                                                             | 法律风险过高（伪造公章），仅允许用户上传自己的 PNG |
| 2026-05-14 | OpenCV.js **完全自托管**（不引用 docs.opencv.org / unpkg）                        | 国内访问稳定 + 离线可用 + 防上游变更打挂           |
| 2026-05-14 | 沿用主 Pixfit 设计系统 / 视觉 token，**不引入新 token**                           | 品牌一致性 + 维护成本最低                          |
| 2026-05-14 | Scanner 主页 / `[docType]` 落地页都进 sitemap，主关键词 SEO 不让步                | 子产品自己也要拿 SEO 流量                          |

---

## 6. 立即下一步

按顺序执行：

1. ✅ **PRD + PLAN 评审** —— 完成（v0.2）
2. ✅ **10 个决策敲定** —— 完成（见 §4）
3. ⬜ **创建 `docs/scanner/tasks/S1.md`** 把 10 个原子任务展开细节、记录 acceptance criteria
4. ⬜ **开 S1**：在当前 `dev-001` 分支或新分支 `feat/scanner-s1-skeleton` 上，按 §3.2 S1 清单逐项做
5. ⬜ **S1 验收**后走一次 Vercel 部署 dry-run，确认子产品路由 / 导航 / i18n 在生产稳定
6. ⬜ 进 **S2/S3**（核心算法链路，最大风险点 = OpenCV.js 加载）

---

## 7. 工程边界（防止偏离）

不在 V1 范围、不在本计划文档跟踪、不接受 PR：

- ❌ AI 自动美化扫描件
- ❌ OCR 字段提取
- ❌ 完整印章库
- ❌ 用户账号 / 跨设备同步
- ❌ 服务端图像处理 fallback（与 Pixfit 主体策略一致）
- ❌ 单文件 > 20 MB
- ❌ 批量处理（> 2 张同时）

以上各自有 V2+ 计划，但 V1 必须拒绝 scope creep。

---

> 文档结束。返回 [./PRD.md](./PRD.md) 或母产品 [../PLAN.md](../PLAN.md)。

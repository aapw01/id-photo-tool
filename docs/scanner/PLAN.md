# 项目计划与里程碑 — Pixfit Scanner

> 本文档是 Scanner 子产品的活看板：里程碑进度、未决问题、技术决策。
> 母产品计划见 [../PLAN.md](../PLAN.md)。需求见 [./PRD.md](./PRD.md)。

---

## 1. 当前状态摘要

| 项         | 值                                                  |
| ---------- | --------------------------------------------------- |
| 子产品名   | **Pixfit Scanner**                                  |
| 路由前缀   | `/[locale]/scanner`                                 |
| 当前阶段   | **S0 · 文档**（PRD / PLAN 撰写中）                  |
| 项目阶段   | 计划阶段 · 未开工                                   |
| 最近更新   | 2026-05-14                                          |
| 一句话进度 | PRD 0.1 完成；执行计划完成；待评审 → 开 S1 路由骨架 |

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

| 里程碑 | 主题                           | 状态      | 预估 | 任务清单                               |
| ------ | ------------------------------ | --------- | ---- | -------------------------------------- |
| S1     | 路由 + 导航 + 骨架             | ⬜ 未开始 | 3 天 | [tasks/S1.md](./tasks/S1.md)（待创建） |
| S2     | 上传 + EXIF + HEIC             | ⬜        | 2 天 | tasks/S2.md                            |
| S3     | OpenCV.js + 透视校正           | ⬜        | 4 天 | tasks/S3.md                            |
| S4     | 输出模式（扫描 / 复印 / 增强） | ⬜        | 3 天 | tasks/S4.md                            |
| S5     | 水印 + A4 排版 + PDF           | ⬜        | 3 天 | tasks/S5.md                            |
| S6     | 多 DocSpec + 多格式导出        | ⬜        | 3 天 | tasks/S6.md                            |
| S7     | SEO 落地页 + JSON-LD           | ⬜        | 3 天 | tasks/S7.md                            |
| S8     | 历史 / ToS / a11y / 上线       | ⬜        | 3 天 | tasks/S8.md                            |

**预计总工期**：~24 工作日 ≈ **4–5 周**（单人节奏）

### 3.2 里程碑详细交付物

#### S1 · 路由 + 导航 + 骨架（3 天）

**目标**：用户可以访问 `/[locale]/scanner` 看到一个**空骨架**页（不报错、有占位 UI、Header 工具下拉能跳转、三语切换正常）。

**交付物清单**（原子任务，预计 8 个）：

- [ ] **S1-T01**：创建 `src/app/[locale]/scanner/page.tsx` 路由（Server Component，SSR）+ `loading.tsx` + `metadata`
- [ ] **S1-T02**：创建 `src/features/scanner/` 模块目录，分层 `components/` `store/` `lib/` `model/`
- [ ] **S1-T03**：写 `src/features/scanner/store/scanner-store.ts`（Zustand），独立于 `studio-store`
- [ ] **S1-T04**：i18n namespace `Scanner.*`：在 `zh-Hans` / `zh-Hant` / `en` 各写 30+ 个 placeholder key，跑 `pnpm i18n:check` 验证一致性
- [ ] **S1-T05**：改 `src/components/site-header.tsx` 把 Studio 单链改成「工具 ▾」下拉（NavigationMenu），含 Studio / Scanner / 规格库 / 排版打印 四项
- [ ] **S1-T06**：改 `src/components/site-mobile-nav.tsx` 加 Scanner tab（移动端底部 4 tab 变 5 tab，或归并到"工具"二级）
- [ ] **S1-T07**：写 `src/features/scanner/components/scanner-shell.tsx` 骨架（左上传区 / 中预览占位 / 右配置面板）
- [ ] **S1-T08**：把 `<ScannerShell />` 用 `dynamic({ ssr: false })` 懒加载到 `/scanner` 页面（同 Studio 模式），减少 SSR 负担

**验收**：

- `pnpm dev` 访问 `/zh-Hans/scanner` / `/zh-Hant/scanner` / `/en/scanner` 三语骨架页正常
- Header「工具 ▾」下拉所有目标可达
- `pnpm typecheck` / `lint` / `test` / `i18n:check` 全绿
- 现有 Studio / Specs / Paper / Templates 测试 0 回归

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

#### S6 · 多 DocSpec + 多格式（3 天）

**目标**：内置 8+ DocSpec 可选；输出能选 PDF / JPG / PNG / ZIP。

**交付物**（预计 7 个原子任务）：

- [ ] **S6-T01**：`src/data/doc-specs.ts` 内置 8 条 DocSpec（cn-id-card / passport / driver-license / household / bank-card / business-license / hk-macao / taiwan）
- [ ] **S6-T02**：`doc-spec-picker.tsx` UI，分组 + 搜索
- [ ] **S6-T03**：DocSpec 切换后默认水印文案 + 排版自动更新
- [ ] **S6-T04**：JPG 输出 pipeline（单张或正反两张）
- [ ] **S6-T05**：PNG 输出 pipeline
- [ ] **S6-T06**：ZIP 输出（用 `client-zip` lib，零依赖纯前端 ZIP，2KB）
- [ ] **S6-T07**：文件命名规范 `{docId}_{purpose}_{YYYYMMDD}.{ext}` 实现

---

#### S7 · SEO 落地页 + JSON-LD（3 天）

**目标**：8 条 DocSpec 各生成一个 SSR 着陆页，三语 24 个 URL 全部进 sitemap。

**交付物**（预计 8 个原子任务）：

- [ ] **S7-T01**：`src/app/[locale]/scanner/[docType]/page.tsx` 动态路由 + `generateStaticParams`
- [ ] **S7-T02**：`generateMetadata` 生成 hreflang × canonical × title × description × OG
- [ ] **S7-T03**：HowTo JSON-LD（3 步固定）
- [ ] **S7-T04**：FAQ JSON-LD（每个 DocSpec 5–7 条问题，i18n 三语）
- [ ] **S7-T05**：BreadcrumbList JSON-LD
- [ ] **S7-T06**：把 24 条 URL 加进 `sitemap-entries.ts`
- [ ] **S7-T07**：Footer 加「热门扫描件」内链矩阵（同 Pixfit 主 Footer 范式）
- [ ] **S7-T08**：单元测试 `metadata.test.ts` / `sitemap-entries.test.ts` 增补

---

#### S8 · 历史 / ToS / a11y / 上线（3 天）

**目标**：localStorage 配置持久化 + 法律 / 隐私文案更新 + 键盘 a11y + 真机 Lighthouse 回归。

**交付物**（预计 8 个原子任务）：

- [ ] **S8-T01**：`scanner-session-store.ts` 写 localStorage `pixfit:scanner:sessions:v1`，LRU 10 条，TTL 30 天
- [ ] **S8-T02**：「最近会话」UI（仅显示 DocSpec + 配置，不存图像）
- [ ] **S8-T03**：增补 `privacy/page.tsx` 加 Scanner 段：明示不上传任何文档照片
- [ ] **S8-T04**：增补 `terms/page.tsx` 加禁止伪造 / 欺诈 / 冒用条款
- [ ] **S8-T05**：4 角拖拽组件键盘可达（Tab/Shift+Tab + 方向键 ±1px / Shift+方向键 ±10px）
- [ ] **S8-T06**：Lighthouse Performance / Accessibility / SEO ≥ 90 三语三页（scanner 主页 + 1 个 detail + studio 对照）
- [ ] **S8-T07**：跑全套：`typecheck / lint / test / i18n:check / format:check / build`，零警告
- [ ] **S8-T08**：更新母 `README.md` + 母 `PLAN.md` 加 Scanner 子产品入口

**验收**：访问 `https://pix-fit.com/scanner` 跑完整流程（上传 → 校正 → 输出 → PDF 下载）无回归；Lighthouse 全绿；母 Studio 0 回归。

---

## 4. 未决问题清单

| 编号 | 问题                                                | 提出日期   | 状态      | 决策 / 备注                                                           |
| ---- | --------------------------------------------------- | ---------- | --------- | --------------------------------------------------------------------- |
| Q1   | Scanner 模块的中文最终名称                          | 2026-05-14 | ⬜ 待决   | 候选："像扫" / "扫描件生成" / "Pixfit Docs" → 等品牌方拍板            |
| Q2   | 是否需要独立 logo？                                 | 2026-05-14 | ⬜ 待决   | 倾向 No，共用主品牌 Logo + 子图标 `ScanLine`                          |
| Q3   | OpenCV.js 选哪个版本                                | 2026-05-14 | ⬜ 待调研 | 候选 4.10.0 LTS vs 5.x dev；S3-T01 时定                               |
| Q4   | OpenCV.js 是否做 IndexedDB 缓存 vs 仅 Cache Storage | 2026-05-14 | ⬜ 待决   | 简单方案 Cache Storage（HTTP 304 友好）；如缓存命中率低再加 IndexedDB |
| Q5   | 默认水印文案是否需要法务审稿                        | 2026-05-14 | ⬜ 待决   | 中英简繁三套 + 通用模板，建议先用通用，跑通后请法务过                 |
| Q6   | 是否在 S1 阶段先做"工具下拉"，还是 S8 一并替换      | 2026-05-14 | ✅ 决策   | S1 一次性改 Header / 移动端 nav，不留尾巴                             |
| Q7   | 移动端 5 个 tab 太挤？                              | 2026-05-14 | ⬜ 待决   | 候选：归并到「工具」二级菜单 / 改成 bottom-sheet                      |
| Q8   | 印章功能是否做                                      | 2026-05-14 | ✅ 决策   | V1 **不做完整印章库**，仅"上传你自己的印章 PNG"。法律风险压制         |
| Q9   | OCR 字段提取放在哪一阶段                            | 2026-05-14 | ✅ 决策   | V1 不做，进 V2 路线图                                                 |
| Q10  | 主 PLAN.md 是否需要同步更新（添加 Scanner 入口）    | 2026-05-14 | ⬜ 待决   | 倾向 S1 启动时一并改；这里**先保留**主 PLAN.md 不动，等用户拍板       |

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

## 6. 立即下一步建议

按优先级排：

1. **用户评审 PRD + PLAN**（本两份文档）→ 拍板未决问题 Q1 / Q7 / Q10
2. **创建 `docs/scanner/tasks/S1.md`** 把 8 个原子任务展开细节
3. **开 S1 分支**：`feat/scanner-s1-skeleton`，按 §3.2 S1 清单逐项做
4. **S1 完成后**走一次 Vercel 部署，确认子产品的路由 / 导航 / i18n 在生产稳定
5. **再进入 S2/S3**（核心算法链路，最大风险点）

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

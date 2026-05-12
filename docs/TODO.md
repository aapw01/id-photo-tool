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
- [ ] 组 C · React 集成（T12–T14）
- [ ] 组 D · Studio 路由（T15–T17）
- [ ] 组 E · 验证（T18–T20）

**关键里程碑**：

- [ ] **首版可演示** — 用户上传一张图，能在 `/studio` 看到 mask 预览（T16+T17 完成）
- [ ] **达到性能 DoD** — 桌面 Chrome 1024² 推理中位数 ≤ 800 ms（T19）

参考：[`TECH_DESIGN.md §5.2 抠图模块`](./TECH_DESIGN.md)

---

## 4. M3+ 长期事项收集池

收到反馈、读 PRD/TECH_DESIGN 时发现但尚未排期的小事，丢到这里，到对应里程碑再消化。

- [ ] **隐私政策与服务条款页面**（M5 或 M8）
  - 当前 Footer 已经有 `/privacy` `/terms` 链接但还没路由，需要 404 兜底或软删除
- [ ] **`/sizes` `/paper` `/templates` 列表页**（M4/M6）
- [ ] **历史会话**（M5 后期，IndexedDB）
- [ ] **国旗 chip 在裁剪选择器**（M4，配合 `flag-icons`）

---

## 维护规范

- 修改本文档时，连同 `PLAN.md` 的「最近更新」一起改时间戳，便于回溯
- 完成项保留 ≥ 2 个里程碑，方便回看；过老的归档到 PLAN.md §6 决策日志
- 增加新事项时分类到上面四节中最合适的一节；不要直接加到末尾

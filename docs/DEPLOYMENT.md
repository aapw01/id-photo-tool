# 部署指南

> Pixfit 在 V1 阶段部署在 Cloudflare Workers（启用 Static Assets），通过
> [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 把 Next.js 16
> 应用打包为 Worker + 静态资源。Cloudflare 已经把 Pages 的 Next.js 适配统一
> 到这条路径，新项目建议直接走 Workers + Assets，而非旧的 next-on-pages。

## 1. 本地一次性准备

```bash
pnpm install
pnpm cf:build       # 产出 .open-next/worker.js 与 .open-next/assets/
pnpm cf:preview     # 本地用 workerd 跑 Cloudflare 模拟器
```

## 2. 接入 Cloudflare（控制台操作）

### 2.1 创建 Workers 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 `Workers & Pages` → `Create` → `Workers` → `Connect to Git`。
3. 选择 GitHub 仓库 `pixfit/pixfit`（或你 Fork 的仓库）。
4. 构建设置：

   | 字段              | 值                              |
   | ----------------- | ------------------------------- |
   | Production branch | `main`                          |
   | Build command     | `pnpm install && pnpm cf:build` |
   | Deploy command    | `pnpm exec wrangler deploy`     |
   | Root directory    | `/`                             |
   | Node.js version   | `20.18` (来自 `.nvmrc`)         |

5. 环境变量：当前 M1 阶段无需任何 secret。后续 M5 会加入 Umami site id 等公开变量。

### 2.2 绑定自定义域名 `pix-fit.com`

> 假设域名 DNS 已由 Cloudflare 托管。

1. 进入 Worker 详情 → `Settings` → `Triggers` → `Custom Domains` → `Add Custom Domain`。
2. 填入 `pix-fit.com`，Cloudflare 会自动创建 A/AAAA 记录并签发 SSL（Universal SSL）。
3. 同样的方式加 `www.pix-fit.com`，并在 DNS 里把 `www` 的 CNAME 设为 `pix-fit.com`。

### 2.3 启用 Web Analytics（可选，M1 不强制）

1. `Web Analytics` → `Add a site` → 选择 `pix-fit.com`。
2. 复制 cookie-less 脚本片段，后续在 `src/app/[locale]/layout.tsx` 里以 `<script>` 注入。
3. 由于走 Cloudflare 边缘注入，**不需要在源码里加 token**。

## 3. 通过 GitHub Actions 部署（推荐）

仓库已经包含 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 与
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)：

- CI 在每个 PR 上运行 lint / typecheck / test / build / i18n:check
- Deploy 在 push 到 `main` 时运行 `wrangler deploy`

需要在 GitHub 仓库 `Settings` → `Secrets and variables` → `Actions` 配置：

| Secret 名称             | 来源                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare Dashboard → `My Profile` → `API Tokens` → 模板 `Edit Cloudflare Workers` |
| `CLOUDFLARE_ACCOUNT_ID` | Workers 项目详情页右侧的 Account ID                                                 |

> 注意：Cloudflare 控制台的 Git 集成会自动构建，与 GitHub Actions 部署是二选一。
> 建议短期用控制台 Git 集成（最快上线），等团队规模上来后再切到 Actions。

## 4. 回滚

```bash
# 列出最近 deployments
pnpm exec wrangler deployments list

# 立即回滚到指定版本
pnpm exec wrangler rollback --message "<reason>" <deployment-id>
```

## 5. 排查清单

| 现象               | 检查项                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| 构建超时 / 内存爆  | Cloudflare 默认 build 内存够，但需注意 Worker bundle ≤ 25 MiB                 |
| 字体 404           | Next.js 自托管字体走 `/_next/static/media/*`，需确保 `.open-next/assets` 完整 |
| 国际化 cookie 不写 | 确认请求经过中间件；Worker 入口必须保留 `middleware` chunk                    |
| 部署后旧版本       | Cloudflare 边缘缓存 \~ 10s；如仍异常，看 `wrangler tail` 实时日志             |

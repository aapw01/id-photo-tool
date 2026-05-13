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

### 2.1 创建 Workers 项目并连接 GitHub（推荐路径）

> Pixfit 选择 **Cloudflare 一侧的 Git 集成** 来做持续部署：Cloudflare
> 自己监听 `main` 分支、自己跑 build / deploy。这样仓库里不需要保管
> 任何 Cloudflare 凭证，没有需要轮换的 `CLOUDFLARE_API_TOKEN`，每次
> push 到 `main` 由 Cloudflare 自动构建发布。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 `Workers & Pages` → `Create` → `Workers` → `Connect to Git`。
3. 授权 Cloudflare 访问 GitHub 账号，选择仓库 `aapw01/id-photo-tool`
   （或你 Fork 的仓库）。
4. 构建设置：

   | 字段              | 值                                                   |
   | ----------------- | ---------------------------------------------------- |
   | Production branch | `main`                                               |
   | Build command     | `pnpm install && pnpm models:fetch && pnpm cf:build` |
   | Deploy command    | `pnpm exec wrangler deploy`                          |
   | Root directory    | `/`                                                  |
   | Node.js version   | `22.13` (来自 `.nvmrc`)                              |

   > `pnpm models:fetch` 在构建期把 MODNet FP16 ONNX（约 13 MB）下载到
   > `public/_models/`。仓库 `.gitignore` 排除了 `*.onnx`，跳过这一步会让
   > 生产环境 `/_models/modnet.fp16.onnx` 返回 404、抠图链路彻底不可用。
   > 默认走 ModelScope 镜像（中国大陆友好），失败自动回落 Hugging Face；
   > 构建容器需具备访问其中至少一个的外网能力（Cloudflare 默认满足）。

5. 环境变量：当前阶段无需任何 secret。可选项：
   - `NEXT_PUBLIC_SEG_MODEL` = `modnet-int8`，可临时切到 INT8（~6.6 MB）以
     节省带宽，代价是发丝边缘略差。
   - `NEXT_PUBLIC_MODEL_URL` = `https://cdn.pix-fit.com/models/modnet.fp16.onnx`，
     模型迁到 R2 + 自定义 CDN 后用，此时 build command 可去掉 `models:fetch`。
6. 保存后 Cloudflare 会立刻触发首次构建。完成后即得到 `*.workers.dev`
   预览域名；后续 `git push origin main` 都会自动重新构建并部署。

### 2.2 绑定自定义域名 `pix-fit.com`

> 假设域名 DNS 已由 Cloudflare 托管。

1. 进入 Worker 详情 → `Settings` → `Triggers` → `Custom Domains` → `Add Custom Domain`。
2. 填入 `pix-fit.com`，Cloudflare 会自动创建 A/AAAA 记录并签发 SSL（Universal SSL）。
3. 同样的方式加 `www.pix-fit.com`，并在 DNS 里把 `www` 的 CNAME 设为 `pix-fit.com`。

### 2.3 启用 Web Analytics（可选，M1 不强制）

1. `Web Analytics` → `Add a site` → 选择 `pix-fit.com`。
2. 复制 cookie-less 脚本片段，后续在 `src/app/[locale]/layout.tsx` 里以 `<script>` 注入。
3. 由于走 Cloudflare 边缘注入，**不需要在源码里加 token**。

## 3. CI 与部署的分工

仓库只保留一个 GitHub Actions workflow：
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)，负责在每个 PR
与每次 push 上跑 lint / typecheck / test / format / i18n:check / build。
**部署本身不由 GitHub Actions 触发**，而是由 Cloudflare 监听 `main`
分支自动完成（见 §2.1）。

这样划分的好处：

- 仓库里不存放任何 Cloudflare 凭证，无 secret 泄露 / 轮换负担。
- GitHub Actions 配额只花在 CI 上，不重复跑构建。
- 构建产物的来源单一：Cloudflare 跑的就是 Cloudflare 部署的。

> 如果未来确实需要 GitHub Actions 主导部署（例如多环境分支策略、需要在
> 部署前后插自定义步骤），再以 [`cloudflare/wrangler-action@v3`][wa] 的
> 方式补回 deploy workflow，并配 `CLOUDFLARE_API_TOKEN` /
> `CLOUDFLARE_ACCOUNT_ID` 两个 secret。

[wa]: https://github.com/cloudflare/wrangler-action

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

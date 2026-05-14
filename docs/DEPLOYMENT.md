# 部署指南

> Pixfit 同时支持 **Cloudflare Workers** 和 **Vercel** 两套生产部署路径，
> 互不冲突。两边都通过自家 Dashboard 的 Git 集成监听 `main` 分支自动构建
> ——仓库本身不存放任何平台凭证。
>
> - **Cloudflare Workers**（§2）—— 通过 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
>   把 Next.js 打包为 Worker + Static Assets。中国大陆访问体验最好；
>   Free 套餐每请求 CPU 上限 10 ms，冷启动有概率触发 1102。
> - **Vercel**（§3）—— Next.js 原生运行时，无 CPU 限制；国内访问慢
>   30–60%；Hobby 免费容量按本项目流量绰绰有余。
>
> §4 给出**两套并存**或**单选其一**的 DNS 切换方式。

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

## 3. 接入 Vercel

> Vercel 是 Next.js 的原生运行时，部署体验最轻 —— 几乎零配置。仓库里
> 的 [`vercel.json`](../vercel.json) 已经声明好 `buildCommand` 会先跑
> `pnpm models:fetch` 拉模型再跑 `pnpm build`。

### 3.1 Dashboard 操作

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard) → `Add New...`
   → `Project`。
2. **Import Git Repository** → 授权 GitHub → 选 `aapw01/id-photo-tool`。
3. **Configure Project**：
   - **Framework Preset**：Vercel 会自动检测为 `Next.js`，无需改。
   - **Build Command** / **Install Command** / **Output Directory**：
     **保持默认 / 留空** —— `vercel.json` 已声明，会覆盖。
   - **Root Directory**：`/`
   - **Environment Variables**：当前阶段无需任何 secret。可选：
     - `NEXT_PUBLIC_SEG_MODEL` = `modnet-int8`（切到 INT8 量化模型，
       6.6 MB，节省带宽，发丝边缘略差）
4. 点 `Deploy`。首次 build 约 2–4 分钟（含模型下载）。完成后得到一个
   `*.vercel.app` 预览域名。
5. 后续 `git push origin main` 由 Vercel 自动构建并 promote 到 production；
   PR / 非 main 分支会自动出 preview deployment。

### 3.2 Function Region 选择

Vercel Hobby 套餐只支持**单一**默认 region，建议在
`Project Settings → Functions → Function Region` 里选 **`hnd1`（Tokyo）**
或 **`sin1`（Singapore）** —— 对中国大陆和东亚用户最快。默认 `iad1`
（华盛顿）对亚太用户体感很差。

升 Pro 套餐后可以在 `vercel.json` 设 `"regions": ["hnd1", "sin1"]`
做多区域。

### 3.3 自定义域名 `pix-fit.com`（如果决定切到 Vercel）

> 见 §4 — DNS 切换流程的所有关键步骤都列在那里，**不要**在两边同时绑
> 同一个根域名。

## 4. DNS / 域名切换

> 域名当前由 Cloudflare 托管。要让 `pix-fit.com` 指向 Vercel，有三条
> 路径，从激进到保守：

### 4.1 全量切到 Vercel（最简单，**推荐**）

1. **在 Cloudflare Dashboard 解绑 Worker Custom Domain**：
   - `Workers & Pages` → `pixfit` Worker → `Settings` → `Triggers` →
     `Custom Domains` → 删除 `pix-fit.com` 和 `www.pix-fit.com`。
   - 不删除 Worker 本身，作为日后回切的备份。
2. **在 Vercel Dashboard 添加域名**：
   - `Project Settings` → `Domains` → `Add` → 输入 `pix-fit.com`。
   - Vercel 会提示 DNS 配置 —— 通常要求加一条：
     ```
     Type: A      Name: @         Value: 76.76.21.21
     Type: CNAME  Name: www       Value: cname.vercel-dns.com
     ```
3. **在 Cloudflare DNS 里改记录**：
   - 找到 `pix-fit.com` 的 A 记录，把 `Value` 改成 Vercel 给的（如
     `76.76.21.21`），并**关闭橙云代理**（点橙色云朵变灰色 "DNS only"）。
   - `www` 的 CNAME 同样改成 `cname.vercel-dns.com`，**关闭橙云代理**。
   - 关代理的原因：Vercel 自己签 SSL + CDN，Cloudflare 代理（橙云）会
     和 Vercel 的边缘冲突，常见症状是 SSL 握手循环 / 521 / 522。
4. **回到 Vercel Dashboard 验证**：等 Vercel 显示 ✅ Valid，访问
   `https://pix-fit.com` 应该是 Vercel 的内容（响应头有 `x-vercel-id`）。
5. **DNS 生效时间**：通常 5–60 分钟，最长 24 小时（取决于 TTL）。

> 🔁 **回滚 Vercel → CF**：在 CF DNS 把 A 记录改回 `192.0.2.1`（任意，
> 因为橙云代理会接管）并把橙云打开 + 在 Worker 上重新绑定 Custom Domain。
> 改 DNS 之后立刻生效，无需重新部署。

### 4.2 CF 反代到 Vercel（保留 CF CDN 加速 / WAF）

> 适合**希望保留 Cloudflare 边缘缓存 + WAF + DDoS 防护**的场景，但要
> 多一层网络跳转。

1. CF DNS 不变 `pix-fit.com` 仍走 Cloudflare（橙云开启）。
2. 解绑 Worker Custom Domain（同 4.1 步 1）。
3. 在 CF Workers 里新建一个**反向代理 Worker**，把所有请求转发到
   `<your-project>.vercel.app`。最小实现：
   ```js
   export default {
     async fetch(req) {
       const url = new URL(req.url)
       url.host = '<your-project>.vercel.app'
       return fetch(url, req)
     },
   }
   ```
4. 把这个反代 Worker 绑到 `pix-fit.com`。
5. **关键配置**：CF SSL/TLS 模式必须是 `Full (strict)`，否则会有证书
   循环错误。

> 性能权衡：多一跳 CF → Vercel，平均增加 30–80 ms 延迟。但 CF 边缘缓存
> 命中时，静态资源（含模型 ONNX）会被命中加速。

### 4.3 两套并存（A/B 测试 / 灰度）

> 适合想同时观察两边性能、做地区灰度的场景。

- `pix-fit.com` → 仍指 Cloudflare Worker（主站）
- `vercel.pix-fit.com` → CNAME 到 `cname.vercel-dns.com`（备站）
- 或反过来

在 Vercel Dashboard 把域名加为 `vercel.pix-fit.com` 即可。

## 5. CI 与部署的分工

仓库只保留一个 GitHub Actions workflow：
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)，负责在每个 PR
与每次 push 上跑 lint / typecheck / test / format / i18n:check / build。
**部署本身不由 GitHub Actions 触发**，而是由 Cloudflare 和 / 或 Vercel 各自
监听 `main` 分支自动完成（见 §2.1 / §3.1）。

这样划分的好处：

- 仓库里不存放任何平台凭证（Cloudflare / Vercel），无 secret 泄露 / 轮换负担。
- GitHub Actions 配额只花在 CI 上，不重复跑构建。
- 构建产物的来源单一：CF 跑的就是 CF 部署的，Vercel 跑的就是 Vercel 部署的。

> 如果未来确实需要 GitHub Actions 主导部署，再以
> [`cloudflare/wrangler-action@v3`][wa] 或
> [`amondnet/vercel-action@v25`][va] 的方式补回 deploy workflow，并配上
> 各自的 secret。

[wa]: https://github.com/cloudflare/wrangler-action
[va]: https://github.com/amondnet/vercel-action

## 6. 回滚

### Cloudflare

```bash
pnpm exec wrangler deployments list
pnpm exec wrangler rollback --message "<reason>" <deployment-id>
```

### Vercel

Vercel Dashboard → `Deployments` → 找到要回滚的目标版本 → 右上角 ⋯ →
`Promote to Production`。或用 CLI：

```bash
pnpm dlx vercel rollback <deployment-url>
```

## 7. 排查清单

### Cloudflare Workers

| 现象                        | 检查项                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| 构建超时 / 内存爆           | Cloudflare 默认 build 内存够，但需注意 Worker bundle ≤ 25 MiB                 |
| 字体 404                    | Next.js 自托管字体走 `/_next/static/media/*`，需确保 `.open-next/assets` 完整 |
| 国际化 cookie 不写          | 确认请求经过中间件；Worker 入口必须保留 `middleware` chunk                    |
| 部署后旧版本                | Cloudflare 边缘缓存 \~ 10s；如仍异常，看 `wrangler tail` 实时日志             |
| `Exceeded CPU Limit` (1102) | Free 套餐 10 ms 限制，详见 `docs/TODO.md`；缓解：UptimeRobot 保活，或升 Paid  |

### Vercel

| 现象                           | 检查项                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| 抠图链路 404 `/_models/*.onnx` | build 没跑 `pnpm models:fetch`；检查 Build Logs 第一步是否成功                        |
| 国内访问超慢                   | Function Region 设为 `iad1`（默认）；改为 `hnd1` 或 `sin1`（Project Settings）        |
| SSL 错误 / 521 / 522           | CF DNS 上橙云没关；自定义域名走 Vercel 时**必须**把代理切到 "DNS only"（灰云）        |
| `next-intl` Cookie 不写        | 确认 `middleware.ts` 部署成功；Vercel `Functions` tab 应能看到 middleware             |
| Build 超时 (10 min Hobby)      | 模型下载是大头，可优化：模型 prebuild 时缓存到 R2/S3，build 时 `MODEL_URL=...` 走 CDN |

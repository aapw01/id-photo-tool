# Docker 镜像与手动部署

镜像发布到 `ghcr.io/aapw01/id-photo-tool`。流水线不连接服务器，不包含 SSH 凭据，也不会自动部署。

## 自动构建

- 提交到 `main`：原生构建 AMD64 和 ARM64 镜像，通过容器启动检查后发布 `sha-<完整提交编号>`，同时更新 `latest`。
- 提交到 `codex/container-packaging`：发布测试用的 SHA 镜像，不更新 `latest`。
- 提交 MR：构建并检查镜像，不发布。
- 手动运行：Actions → Container image → Run workflow。工作流合并到默认分支后可使用此入口。

镜像检查覆盖页面、语言跳转、404、JS/CSS、图标和完整模型文件的 SHA-384。现有 CI 继续负责 lint、类型、翻译、单元测试和常规构建。

两个架构均检查成功后才创建统一的 SHA 标签。部署时使用该标签或 digest，便于追溯和回退。GHCR 的初始可见性由仓库／包设置决定；私有包需要具有 `read:packages` 权限的凭据才能拉取。

## 构建参数

以下值会写入 Next.js 构建产物，不能在启动容器时替换：

| 参数                            | 默认值                | GitHub 配置                                                       |
| ------------------------------- | --------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://pix-fit.com` | Repository Settings → Secrets and variables → Actions → Variables |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 空，不加载 GA4        | 同上；测试部署建议保持为空，避免污染正式统计                      |

这些都是公开配置，不要放入私密凭据。自托管时不会加载 Vercel Analytics 和 Speed Insights。现有 GA4 初始化关闭自动 `page_view`，启用 GA4 后自定义事件可继续使用，但正式迁移前需要单独确认页面访问统计。

Docker 构建使用 Node.js 22 和项目固定的 pnpm 版本，启用 `DOCKER_BUILD=1` 生成 standalone 输出；Vercel 和 Cloudflare 构建不设置这个变量，因此保持原输出方式。构建时下载默认 FP16 模型，运行时随镜像提供，模型仍在用户浏览器执行。

## 手动部署

服务器只需 Docker 和 Compose，不需要源码或 Node.js。复制仓库根目录的 `compose.yaml` 到独立部署目录，创建 `.env`：

```dotenv
PIXFIT_IMAGE=ghcr.io/aapw01/id-photo-tool:sha-替换为完整提交编号
PIXFIT_PORT=3000
```

```bash
docker compose pull
docker compose up -d
docker compose ps
curl -I http://127.0.0.1:3000/zh-Hans
```

Compose 默认只绑定 `127.0.0.1`，不会占用 80 或 443，也不会把未配置 HTTPS 的应用直接暴露到公网。为浏览器图像处理功能配置可信 HTTPS 后再做完整验收；普通公网 HTTP 不满足部分浏览器 API 的安全上下文要求。

接入现有反向代理或独立测试域名前，确认端口、证书和域名安排。不要为部署本项目停止其他正在占用端口的服务。测试域名应在代理层增加 `X-Robots-Tag: noindex, nofollow`，避免重复收录；不要把 Next.js HTML/RSC 响应直接设置为全站强制缓存。

这是单容器手动更新配置，替换版本可能有短暂中断，不包含蓝绿发布或自动回滚。回退时将 `.env` 的 `PIXFIT_IMAGE` 改回之前的 SHA，再执行 `docker compose up -d`。

## 本地构建与验证

```bash
docker build -t pixfit:local .
docker run --rm -d --name pixfit-smoke -p 127.0.0.1:3000:3000 pixfit:local
node scripts/container-smoke.mjs
docker rm -f pixfit-smoke
```

容器以非 root 用户运行；Next.js 缓存保存在容器内，重建后可以重新生成。该应用不在服务器保存用户照片，也无需数据库或用户上传目录。

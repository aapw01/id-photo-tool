# Pixfit · 像配

> 浏览器内一站式证件照工作台 — 换底色、裁剪、排版、压缩、导出，照片不离开你的设备。

[![CI](https://github.com/your-org/pixfit/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/pixfit/actions)

## 文档

- 产品需求：[docs/PRD.md](docs/PRD.md)
- 技术架构：[docs/TECH_DESIGN.md](docs/TECH_DESIGN.md)
- 项目计划：[docs/PLAN.md](docs/PLAN.md)
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- 当前里程碑任务：[docs/tasks/M1.md](docs/tasks/M1.md)

## 本地开发

环境要求：

- Node.js 20.18+（推荐使用 `nvm`，仓库根有 `.nvmrc`）
- pnpm 11+

```bash
pnpm install
pnpm dev
```

访问 <http://localhost:3000>。

## 常用脚本

```bash
pnpm dev            # 启动开发服务器
pnpm build          # 生产构建
pnpm start          # 启动生产服务器
pnpm lint           # ESLint 检查
pnpm typecheck      # tsc --noEmit
pnpm format         # Prettier 写盘
pnpm test           # vitest run
pnpm i18n:check     # 三语言 key 一致性
pnpm models:fetch   # 拉取 MODNet ONNX 模型到 public/_models/（M2 起）
pnpm cf:build       # 用 OpenNext 打包为 Cloudflare Worker
```

## 模型资产

抠图能力使用上游开源模型 [`Xenova/modnet`](https://huggingface.co/Xenova/modnet)（Apache-2.0），
本仓库 **不** 把 `.onnx` 文件提交进 git。首次开发或 CI 跑：

```bash
pnpm models:fetch
```

脚本会把 `model_quantized.onnx`（约 6.63 MB，INT8）下载到 `public/_models/modnet.q.onnx`
并打印 SHA-384 摘要，请把它写入 [`src/features/segmentation/integrity.ts`](src/features/segmentation/integrity.ts)
的 `MODEL_SHA384` 常量后再提交。

### 国内网络下载

Hugging Face 当前把权重文件托管在 `cas-bridge.xethub.hf.co`，在中国大陆常被劫持/阻断。
若 `pnpm models:fetch` 在你的网络下失败，三种解决方式（任选其一）：

1. **设置代理后重试**（最简单）

   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch
   ```

2. **从其他设备下载好后导入**

   ```bash
   pnpm models:fetch --from-file ./model_quantized.onnx
   ```

3. **切换 HF 镜像**（注意 hf-mirror 仍会把权重重定向到 xethub，未必有效）

   ```bash
   HF_ENDPOINT=https://hf-mirror.com pnpm models:fetch
   ```

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + Lucide Icons
- next-intl（国际化）
- ONNX Runtime Web（浏览器内 AI 抠图，后续里程碑加入）
- 部署：Cloudflare Pages（计划）

## License

待定（见 [docs/PRD.md §14.1](docs/PRD.md)）。

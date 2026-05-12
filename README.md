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

脚本会按顺序尝试 **ModelScope（国内镜像，默认）→ Hugging Face**，自动落到 `public/_models/modnet.q.onnx`
（约 6.32 MB，INT8 量化，SHA-256 `92e49898...`）。模型 SHA-384 摘要已经固化在
[`src/features/segmentation/integrity.ts`](src/features/segmentation/integrity.ts) 的 `MODEL_SHA384`
常量中——下载完成后运行时会自动校验。

> ModelScope 是阿里维护的 Hugging Face 国内镜像，提供与 HF 完全相同的文件（`X-Linked-Etag` 一致），
> 国内直连可达；HF 当前所有权重都走 `cas-bridge.xethub.hf.co`，在大陆常被 DNS 劫持。

### 备用下载方式

如果默认下载失败（公司内网限制等），三种 fallback：

1. **从浏览器手动下载**（最直观）
   - ModelScope（推荐）：<https://www.modelscope.cn/models/Xenova/modnet/resolve/master/onnx/model_quantized.onnx>
   - Hugging Face（需可访问）：<https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx?download=true>

   然后导入：

   ```bash
   pnpm models:fetch --from-file ~/Downloads/model_quantized.onnx
   ```

2. **设置代理**

   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 pnpm models:fetch
   ```

3. **指定自定义 URL**（例如部署到 R2 后用自己的 CDN）

   ```bash
   MODEL_URL=https://cdn.pix-fit.com/models/modnet.q.onnx pnpm models:fetch
   ```

> 如果上游模型更新，脚本会因 SHA-384 不匹配在运行时报错——届时更新
> [`integrity.ts`](src/features/segmentation/integrity.ts) 的 `MODEL_SHA384` 常量即可。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + Lucide Icons
- next-intl（国际化）
- ONNX Runtime Web（浏览器内 AI 抠图，后续里程碑加入）
- 部署：Cloudflare Pages（计划）

## License

待定（见 [docs/PRD.md §14.1](docs/PRD.md)）。

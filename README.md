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
pnpm dev          # 启动开发服务器
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm lint         # ESLint 检查
```

> 更完整的脚本与流程会随里程碑推进逐步补全。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + Lucide Icons
- next-intl（国际化）
- ONNX Runtime Web（浏览器内 AI 抠图，后续里程碑加入）
- 部署：Cloudflare Pages（计划）

## License

待定（见 [docs/PRD.md §14.1](docs/PRD.md)）。

# Now What

把要做的事安排进日程：创建事务、拖进日 / 周 / 月日程表、到期前完成、完成后归档。

## 环境要求

- Node.js ≥ 22（推荐 24 LTS）
- pnpm 11

仓库在 `package.json` 中声明了 `packageManager: pnpm@11.28.5`，推荐用 Corepack 管理：

```bash
corepack enable
corepack prepare pnpm@11.28.5 --activate
pnpm --version
```

或者直接全局安装：

```bash
npm install -g pnpm@11
```

> 如果 `pnpm` 提示 command not found，先执行上面的安装步骤；`pnpm dev` 等脚本内部会再次调用 `pnpm`，因此必须能在 PATH 中找到它。

## 快速开始

```bash
pnpm install
pnpm dev
```

- 前端：http://localhost:5173
- 后端：http://127.0.0.1:3000
- 前端通过 Vite 代理把 `/api` 转发到后端

首次启动会自动创建 `data/nowwhat.db` 并执行迁移。

## 环境变量

默认配置即可运行；需要覆盖时复制 `.env.example` 为 `.env`，或直接设置环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端监听端口 |
| `DATABASE_URL` | `data/nowwhat.db` | SQLite 文件路径 |
| `UPLOAD_DIR` | `data/uploads` | 附件落盘目录 |

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 同时启动 Vite 与 Fastify |
| `pnpm build` | 构建 `shared` 与前端产物 |
| `pnpm start` | 单进程启动，Fastify 托管前端与 API（3000 端口） |
| `pnpm check` | 类型检查 + 单元/集成测试 + 构建 |
| `pnpm e2e` | 构建后跑 Playwright 端到端测试（本地用系统 Edge，CI 用 Chromium） |
| `pnpm test:e2e` | 直接跑 E2E，要求已有构建产物 |
| `pnpm db:generate` | 根据 schema 生成迁移 |
| `pnpm db:migrate` | 执行迁移 |
| `pnpm --filter @nowwhat/api openapi` | 重新生成 `apps/api/openapi.json` |

## 目录

```
apps/api/        Fastify + Drizzle + SQLite
apps/web/        Vite + Vue 3 + TypeScript + Tailwind CSS 4
packages/shared/ 领域纯函数与 zod schema（前后端共用）
specs/           功能规格与验收标准
docs/adr/        架构决策记录
docs/backlog.md  待排期的扩展需求
plan.md          里程碑、TDD 流程与 git 规范
```

## 文档

- 技术架构：[architecture.md](architecture.md)
- 开发计划：[plan.md](plan.md)
- 功能规格：[specs/](specs/)
- 决策记录：[docs/adr/](docs/adr/)

`docs/requirements/` 与 `prototype/` 为本地设计资料，不纳入版本管理。
## 持续集成

`.github/workflows/ci.yml` 在每次 push 到 `main` 和 Pull Request 时运行：

1. 类型检查、单元与集成测试、前端构建
2. 校验 `apps/api/openapi.json` 与代码一致（不一致则失败）
3. Playwright 端到端测试（Ubuntu + Chromium，失败时上传报告）

本地可先跑 `pnpm check` 和 `pnpm e2e` 复现同样的检查。

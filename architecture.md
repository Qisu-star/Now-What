# Now What 技术架构

> 配套文档：[需求文档 v1.2](docs/requirements/Now_What_v1.2.docx)
> 版本：v1.0 ｜ 日期：2026-11-08

## 1. 项目简介

Now What 是一个日程规划 Web 应用：用户创建带优先级、起止时间、附件的「事务」，把事务卡片安排进日 / 周 / 月日程表，到期后手动确认完成并归档，日程可导出为表格或图片。

- **目标用户**：学生与个人开发者，单用户使用。
- **本期范围**：Web 端（含手机浏览器适配），单机部署，无账号体系。
- **核心模型**：事务（Task）、计划时段（Placement）、附件（Attachment）。
- **本期不做**：子事务、日程导入、搜索筛选、PC / 移动客户端、账号与云端同步。

## 2. 技术选型

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 前端框架 | Vue 3 + Vite + TypeScript | 单页应用；Vite 提供 HMR 与构建 |
| 样式 | Tailwind CSS 4 | CSS-first 配置，使用 `@tailwindcss/vite` 插件 |
| 状态管理 | Pinia | 事务列表、视图状态、选中项等共享状态 |
| 路由 | vue-router 4 | 视图与日期写进 URL，刷新与多标签页可复现 |
| HTTP 客户端 | openapi-fetch + openapi-typescript | 由 OpenAPI 生成的类型化客户端 |
| 后端 | Node.js（≥ 22，推荐 24 LTS）+ Fastify + TypeScript | 轻量、schema 驱动，插件覆盖 multipart / static / cors |
| 契约 | OpenAPI 3.1，由 zod schema 生成 | 后端 schema 是唯一事实来源，避免契约与实现漂移 |
| 校验 | zod | 同一份 schema 用于后端校验与前端表单校验 |
| 数据库 | SQLite + Drizzle ORM | 单文件、零运维；Drizzle 提供类型化查询与迁移 |
| 附件 | 本地文件目录 + 数据库存元数据 | 单文件 ≤ 20 MB |
| 包管理 | pnpm workspace | 前后端与共享包同一仓库 |
| 测试 | Vitest + Playwright | 单元 / 集成 / 端到端 |

## 3. 总体架构

```
浏览器
  Vue 3 SPA（Vite 构建）
      │  HTTP / JSON（OpenAPI 契约）
      ▼
Fastify 应用（Node.js）
  ├─ REST API  /api/v1
  ├─ 静态资源托管（生产环境托管 web 构建产物）
  └─ 领域逻辑（时间段计算、冲突检测）
      │
      ├─ SQLite   data/nowwhat.db
      └─ 附件目录 data/uploads/
```

生产环境是**单进程**：一个 Node 进程同时提供 API 与前端静态资源。开发环境由 Vite dev server 把 `/api` 代理到后端。

**为什么用本地后端**：需求要求本期数据存本地。SQLite 与附件都落在本机 `data/` 目录，满足该要求；同时提前落地了服务端形态，未来迁移到 Postgres 或部署到服务器时只需替换数据层与部署方式，前端不动。

## 4. 仓库结构

```
now-what/
├─ apps/
│  ├─ web/                    # Vite + Vue 3 + TS + Tailwind 4
│  │  └─ src/
│  │     ├─ api/              # 生成的类型与客户端
│  │     ├─ components/
│  │     ├─ composables/      # 拖拽、缩放、吸附
│  │     ├─ views/            # 日 / 周 / 月视图
│  │     └─ stores/           # Pinia
│  └─ api/                    # Fastify + TS
│     └─ src/
│        ├─ routes/
│        ├─ db/               # Drizzle schema 与迁移
│        ├─ domain/           # 时间与冲突计算
│        └─ plugins/          # swagger、multipart、static
├─ packages/
│  └─ shared/                 # zod schema、时间工具、冲突检测（前后端复用）
├─ data/                      # 运行时生成，不纳入版本管理
├─ docs/requirements/
└─ architecture.md
```

## 5. 前后端契约

- **单一事实来源**：`packages/shared` 中的 zod schema。
- 后端用 `fastify-type-provider-zod` 注册路由，`@fastify/swagger` 导出 `openapi.json`。
- 前端用 `openapi-typescript` 生成 `schema.d.ts`，再用 `openapi-fetch` 调用，参数与返回值都有类型。
- 路径统一 `/api/v1` 前缀；破坏性变更升版本号。
- 错误响应统一为 `{ "error": { "code": "...", "message": "...", "details": ... } }`，HTTP 状态码语义化。
- 时间字段一律使用 ISO 8601 UTC 字符串，例如 `2026-11-08T12:00:00Z`。

### 主要接口（草案）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/tasks` | 事务列表，支持 status / priority 过滤 |
| POST | `/api/v1/tasks` | 创建事务，同时执行自动落位 |
| GET / PATCH / DELETE | `/api/v1/tasks/{id}` | 详情 / 修改 / 删除 |
| POST | `/api/v1/tasks/{id}/complete` | 确认完成并归档 |
| POST | `/api/v1/tasks/{id}/unarchive` | 撤销归档 |
| GET | `/api/v1/placements?from=&to=` | 按日期范围取计划时段 |
| POST | `/api/v1/placements` | 新增安排，服务端校验时段冲突 |
| PATCH / DELETE | `/api/v1/placements/{id}` | 移动 / 拉伸 / 移除安排 |
| POST | `/api/v1/attachments` | 上传附件（multipart） |
| GET | `/api/v1/attachments/{id}/content` | 预览或下载附件 |
| GET | `/api/v1/history` | 历史事务，支持排序与分页 |

## 6. 数据模型与存储

- 表：`tasks`、`placements`、`attachments`。
- `tasks`：事务周期存 UTC；归档信息作为列存放在同一张表（`completed_at`、`completion_note`、`archived_at`、`last_updated_at`）。
- `placements`：`day`（本地日期）+ `start_minute` / `end_minute`（0–1440），表示日历上的位置，不存 UTC。
- `attachments`：元数据入库，文件落盘到 `data/uploads/{taskId}/{attachmentId}`。
- 迁移：使用 `drizzle-kit`，迁移文件纳入版本管理，启动时自动执行。

**时间处理**：事务周期用 UTC，计划时段用墙上时间（日期 + 分钟）。业务代码通过可注入的 `Clock` 取当前时间，不直接 `new Date()`。本期假设单时区（Asia/Shanghai），跨天安排按天切分渲染。详见 [ADR-002](docs/adr/002-time-handling.md)。

## 7. 关键实现约定

- **时段独占**：冲突检测与吸附计算放在 `packages/shared`，前端交互与后端校验共用同一份逻辑，避免两边规则漂移。
- **自由缩放**：卡片按绝对位置渲染，时间格只作背景刻度；拖动与拉伸用 Pointer Events 自研，不引入拖拽库。
- **多标签页同步**：数据在服务端，标签页之间用 `BroadcastChannel` 广播「数据已变更」，收到后失效缓存并重新拉取。
- **导出**：表格用 ExcelJS、图片用 html-to-image，均在前端完成，不新增导出接口。
- **单用户无鉴权**：服务默认只监听 `127.0.0.1`，不对外暴露。

## 8. 开发与部署

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 同时启动 Vite（5173）与 Fastify（3000），前端代理 `/api` |
| `pnpm build` | 构建 web 与 api |
| `pnpm start` | 单进程启动，Fastify 托管 web 构建产物与 API |
| `pnpm db:generate` / `pnpm db:migrate` | 生成 / 执行数据库迁移 |
| `pnpm test` / `pnpm test:e2e` | 单元测试 / 端到端测试 |

环境变量：`DATABASE_URL`（默认 `data/nowwhat.db`）、`PORT`（默认 3000）、`UPLOAD_DIR`（默认 `data/uploads`）。

## 9. 测试

- **单元**：`shared` 的时间计算与冲突检测（Vitest）。
- **集成**：Fastify 路由 + 临时 SQLite 文件，使用 `inject` 发请求。
- **端到端**：Playwright 覆盖创建事务、拖拽排期、归档、导出四条主链路。

## 10. 风险与后续

- **Tailwind CSS 4 浏览器基线**：需要 Safari 16.4+ / Chrome 111+，符合当前兼容目标；若将来要支持更老浏览器，降级到 v3。
- **SQLite 单写**：单用户场景足够；并发写压力变大时切换 Postgres，Drizzle 层改动较小。
- **备份**：数据库与附件都在 `data/`，备份即复制该目录。
- **未来多端**：API 已按服务端形态设计，补齐鉴权与用户维度即可支持多用户与云端同步。

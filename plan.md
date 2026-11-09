# 开发计划

> 版本：v1 ｜ 日期：2026-11-08
> 关联：[specs/](specs/)、[docs/adr/](docs/adr/)、[architecture.md](architecture.md)

## 1. 工作方式

每个功能按同一个循环推进：

```
Spec（要达到什么） → Plan（什么时候做、怎么验收） → TDD（先测后写） → 验收记录 → 提交
```

- **Spec 是验收依据**：实现与验收都必须能追溯到具体 AC；需求变化先改 Spec，再改代码。
- **ADR 记录系统决策**：涉及架构取舍时先写 ADR，避免同类问题反复讨论。
- **TDD 先测后写**：先写失败的测试，再写实现让它通过，最后重构。测试与实现放在同一个提交里，保证提交历史始终是绿的。
- **Definition of Done**：该里程碑涉及的 AC 全部通过；`pnpm check` 通过；Spec 的验收记录已填写；合入 `main`。

## 2. 里程碑

### M0 脚手架与基础设施

| 项 | 内容 |
| --- | --- |
| 目标 | 一条能跑的链路：前端页面 → API → SQLite |
| 产物 | pnpm workspace（`apps/web`、`apps/api`、`packages/shared`）；`.npmrc` 指定 `node-linker=hoisted`；TypeScript 5.9；Fastify + Drizzle + SQLite；`/api/v1/health`；单进程托管前端构建产物 |
| 测试 | 先写 `health` 的集成测试，再实现路由 |
| 完成标准 | `pnpm dev` 双端可起；`pnpm build && pnpm start` 单端口可访问；`pnpm check` 通过 |

### M1 事务闭环

| 项 | 内容 |
| --- | --- |
| 目标 | 能创建、查看、编辑、删除事务，并自动落位 |
| 对应 | [001](specs/001-task-management.md)、[002](specs/002-task-list.md)、[004](specs/004-scheduling.md) BR-05 |
| 产物 | shared：zod schema、校验、时间工具、自动落位；api：tasks CRUD；web：列表、创建弹窗、详情查看/编辑/删除 |
| 测试 | shared 校验与落位单测；api 路由集成测试；E2E 覆盖创建与编辑 |
| 完成标准 | 001 的 AC-01~06、002 的 AC-01~05 全部通过 |

### M2 周视图与排期

| 项 | 内容 |
| --- | --- |
| 目标 | 周视图可用，能拖入、移动、拉伸，冲突被拒绝 |
| 对应 | [003](specs/003-calendar-views.md) 周视图部分、[004](specs/004-scheduling.md) |
| 产物 | 时间网格与卡片渲染；拖拽/拉伸/吸附；命中判定；placements API；409 回滚 |
| 测试 | 先写 shared 的冲突、吸附、命中单测；再写 placements API 测试；最后 E2E 拖拽 |
| 完成标准 | 004 的 AC-01~07 全部通过 |

### M3 归档与历史

| 项 | 内容 |
| --- | --- |
| 目标 | 事务能完成归档、进历史、可撤销 |
| 对应 | [005](specs/005-archive-history.md) |
| 产物 | complete / unarchive 接口；归档弹窗；历史面板；灰色卡片 |
| 测试 | api 状态流转测试；组件排序测试；E2E 归档与撤销 |
| 完成标准 | 005 的 AC-01~06 全部通过 |

### M4 日视图、月视图与切换

| 项 | 内容 |
| --- | --- |
| 目标 | 三种视图齐全，切换、翻页、月表进周 |
| 对应 | [003](specs/003-calendar-views.md) |
| 产物 | 日表、月表；视图切换与翻页；月表周标签；当日预览 |
| 测试 | 日历计算单测；E2E 切换与翻页 |
| 完成标准 | 003 的 AC-01~06 全部通过 |

### M5 附件与导出（延后）

对应 [006](specs/006-attachments-and-export.md)。核心闭环验收通过后再排期。

### M6 移动端与多标签页（延后）

移动端布局、BroadcastChannel 同步。

## 3. TDD 约定

| 层次 | 工具 | 先写什么 |
| --- | --- | --- |
| 领域逻辑 | Vitest | 冲突、落位、吸附、命中、校验；每条规则一个用例 |
| API | Vitest + Fastify inject + 临时 SQLite | 先写请求与期望状态码，再实现路由 |
| 组件 | Vitest + Vue Test Utils | 交互规则与四态（加载 / 成功 / 空 / 错误） |
| 端到端 | Playwright | 只覆盖主链路：创建 → 排期 → 归档 → 撤销 |

原则：

- 一次只让一个测试变绿；不要先写一堆实现再补测试。
- 测试名描述行为，不描述实现细节。
- 时间相关测试使用固定时钟，禁止依赖真实当前时间。
- 断言可观察结果（HTTP 状态、数据库状态、界面文本），不断言内部调用。

## 4. Git 规范

**分支**

- `main` 始终保持可运行，只接受已验证的合并。
- 每个里程碑一条分支：`feat/m1-task-crud`、`fix/m2-drag-conflict`。
- 合并使用 `--no-ff`，保留里程碑的提交历史。

**提交信息**（Conventional Commits）

```
<type>(<scope>): <subject>

type: feat | fix | test | refactor | docs | chore | build | ci
scope: web | api | shared | specs | adr | plan
```

示例：

- `feat(shared): 实现时段重叠判定与自动落位`
- `test(api): 补充创建事务的校验用例`
- `docs(specs): 补充 004 的冲突验收标准`

**提交粒度**

- 一个提交对应一个可验证的行为；TDD 的测试与实现放在一起。
- 提交前至少跑通该改动相关的测试；里程碑收尾跑 `pnpm check`。
- 不提交生成物以外的构建产物；`data/`、`node_modules/`、`prototype/`、`docs/requirements/` 已在 `.gitignore` 中排除。

**首次提交**

- `chore: 初始化架构、spec 与开发计划`，包含 `architecture.md`、`specs/`、`docs/adr/`、`docs/backlog.md`、`plan.md`、`.gitignore`。

## 5. 质量门禁

```bash
pnpm check   # typecheck + test + build
```

- 合入 `main` 前必须通过。
- 契约生成物（`openapi.json`、前端类型）需与源码一致；CI 里重新生成后比较，出现差异即失败。

## 6. 风险与应对

| 风险 | 应对 |
| --- | --- |
| pnpm 11 在 Windows 上的链接问题 | 项目级 `.npmrc` 固定 `node-linker=hoisted`，M0 首日验证 |
| TypeScript 7 与工具链兼容性 | 先用 5.9；等 `vue-tsc` 明确支持后再评估升级 |
| 拖拽交互复杂度高 | 规则先落成 shared 纯函数并测试，UI 只负责把指针映射到时间 |
| 时区与跨天边界 | 固定时钟测试；跨天卡片按天切分渲染的用例单独覆盖 |
| SQLite 并发写 | 单用户场景可接受；开启 WAL，写操作串行化 |
| 前端状态与后端不一致 | 所有写操作以服务端返回为准；失败时回滚并提示 |

## 7. 进度

| 里程碑 | 状态 | 完成日期 | 备注 |
| --- | --- | --- | --- |
| M0 脚手架 | 完成 | 2026-11-08 | 健康检查链路已打通，见下方记录 |
| M1 事务闭环 | 完成 | 2026-11-09 | 见下方 M1 记录 |
| M2 周视图与排期 | 未开始 | | |
| M3 归档与历史 | 未开始 | | |
| M4 日/月视图 | 未开始 | | |
| M5 附件与导出 | 延后 | | |
| M6 移动端与同步 | 延后 | | |

### M0 实现记录

- `packages/shared` 编译为 `dist` 再被引用：Node 不允许对 `node_modules` 内的 TS 做类型剥离，workspace 包正好链接在那里。
- API 直接以 Node 24 的类型剥离运行 `src/server.ts`，不需要单独的编译步骤；生产环境要求 Node ≥ 22。
- 数据库迁移由 `drizzle-kit generate` 生成，启动时自动执行；`data/` 已在 `.gitignore` 中。
- 契约链路已打通：zod schema → `apps/api/openapi.json`，可用 `pnpm --filter @nowwhat/api openapi` 重新生成。
- pnpm 11 的配置集中在 `pnpm-workspace.yaml`（`nodeLinker: hoisted`、`strictDepBuilds: false`），`.npmrc` 不再生效。

### M1 实现记录

- shared 增加校验、时段运算、优先级排序、本地时间换算，共 34 条单元测试。
- API 提供 `GET/POST/PATCH/DELETE /api/v1/tasks`，创建时自动落位，改截止时间时未手动调整的自动卡片跟随；集成测试 13 条。
- 前端完成列表（按优先级分组、拼音排序、逾期标识）、创建/查看/编辑/删除弹窗。
- 契约已包含事务接口，重生成命令：`pnpm --filter @nowwhat/api openapi`。
- 开发便捷入口：`/?ui=create` 打开新建弹窗，`/?ui=detail&id=<taskId>` 打开详情。

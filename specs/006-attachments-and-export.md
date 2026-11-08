# 006：附件与导出

> 状态：延后
> 关联事项：无
> 关联 Spec：[001 事务管理](001-task-management.md)、[005 归档与历史](005-archive-history.md)

## 目标

用户能给事务或归档记录附加材料，并把当前视图导出成表格或图片，便于分享和留档。

## 用户故事

作为学生，我希望把课程通知的 PDF 附在事务上，并在周末把本周日程导出成图片发给同学。

## 范围

- 事务附件：上传、列出、预览或下载、删除。
- 归档附件：确认完成时附加材料。
- 表格导出：当前视图导出为 `.xlsx`。
- 图片导出：当前视图导出为 `.png`。

## 非目标

- 附件在线协同编辑。
- 导出为 PDF 或打印排版。
- 跨视图批量导出（只导出当前视图）。

## 业务规则

- **BR-01 格式**：支持 `.md`、`.docx`、`.pdf`、`.jpg`、`.jpeg`、`.png`。
- **BR-02 大小**：单个文件不超过 20 MB；超出时拒绝并提示。
- **BR-03 存储**：元数据入库，文件落盘到 `data/uploads/{taskId}/{attachmentId}`；不把二进制存进数据库。
- **BR-04 预览**：图片与 `.md` 可在线预览；其余格式提供下载。
- **BR-05 级联**：删除事务时一并删除其附件文件与记录。
- **BR-06 表格导出**：内容与当前视图显示一致，不含样式；图片导出覆盖当前视图完整内容。
- **BR-07 导出命名**：文件名包含视图类型与日期范围，避免覆盖。

## Contract 影响

- 结论：新增
- 理由或影响摘要：附件需要 multipart 上传与文件流下载；导出在前端完成，不新增接口
- OpenAPI operation：`POST /api/v1/attachments`、`GET /api/v1/attachments/{id}/content`、`DELETE /api/v1/attachments/{id}`
- 迁移 / 废弃安排：不适用

## 验收标准

- **AC-01**：给定一个 18 MB 的 PDF，当上传到事务，则上传成功并出现在附件列表，可下载且内容一致。
- **AC-02**：给定一个 25 MB 的文件，当上传，则返回 413，界面提示超出限制。
- **AC-03**：给定一个 `.exe` 文件，当上传，则返回 415，界面提示格式不支持。
- **AC-04**：给定包含图片附件的归档事务，当打开详情，则图片可直接预览，PDF 提供下载。
- **AC-05**：给定周视图，当导出表格，则生成的 `.xlsx` 行列为当前周的日期与时间格，内容与界面一致。
- **AC-06**：给定周视图，当导出图片，则生成的 `.png` 覆盖当前周全部内容，无裁切。

## 验证映射

| AC | 验证方式 | 命令或可复现步骤 | 结果 / 证据 |
| --- | --- | --- | --- |
| AC-01 | API | `pnpm --filter api test attachments.upload` | 待填 |
| AC-02 | API | `pnpm --filter api test attachments.too-large` | 待填 |
| AC-03 | API | `pnpm --filter api test attachments.bad-type` | 待填 |
| AC-04 | E2E | `pnpm test:e2e -- attachment-preview` | 待填 |
| AC-05 | E2E | `pnpm test:e2e -- export-xlsx` | 待填 |
| AC-06 | E2E | `pnpm test:e2e -- export-png` | 待填 |

## 验收记录

- `pnpm check`：未开始
- 人工验收：不适用
- 已知限制：本期（M0–M4）不实现，排在 M5。

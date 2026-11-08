# Spec 索引

本目录描述「要达到什么结果」，不规定文件、组件或内部实现。实现细节走 `docs/adr/`，排期与提交走 `plan.md`。

## 状态约定

| 状态 | 含义 |
| --- | --- |
| 草案 | 待确认，可能调整 |
| 已确认 | 可以据此实现与验收 |
| 已实现 | 验收记录已填写 |
| 延后 | 不在本期范围 |

## 列表

| 编号 | 文件 | 范围 | 状态 |
| --- | --- | --- | --- |
| 001 | [001-task-management.md](001-task-management.md) | 事务创建、查看、编辑、删除与校验 | 草案 |
| 002 | [002-task-list.md](002-task-list.md) | 未完成事务列表：分组、排序、逾期标识 | 草案 |
| 003 | [003-calendar-views.md](003-calendar-views.md) | 日 / 周 / 月视图、翻页、切换、月表进周 | 草案 |
| 004 | [004-scheduling.md](004-scheduling.md) | 自动落位、拖拽、拉伸、时段独占 | 草案 |
| 005 | [005-archive-history.md](005-archive-history.md) | 完成归档、历史列表、撤销归档 | 草案 |
| 006 | [006-attachments-and-export.md](006-attachments-and-export.md) | 附件与导出 | 延后 |

## 相关文档

- 需求来源：`docs/requirements/Now_What_v1.2.docx`（本地保留，不进 git）
- 架构与技术选型：[architecture.md](../architecture.md)
- 系统决策：[docs/adr/](../docs/adr/)
- 开发排期：[plan.md](../plan.md)
- 设计原型：`prototype/`（本地保留，不进 git）
- 扩展需求：`docs/backlog.md`

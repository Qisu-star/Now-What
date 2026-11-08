import { describe, expect, it } from 'vitest'
import { sortTasks } from './sort.ts'
import type { Task } from './types.ts'

function task(id: string, title: string, priority: Task['priority']): Task {
  return {
    id,
    title,
    description: '',
    priority,
    startAt: '2026-11-09T01:00:00Z',
    endAt: '2026-11-10T10:00:00Z',
    color: 0,
    status: 'active',
    completedAt: null,
    archivedAt: null,
    note: '',
    createdAt: '2026-11-08T00:00:00Z',
    updatedAt: '2026-11-08T00:00:00Z'
  }
}

describe('sortTasks', () => {
  it('先按优先级，再按名称拼音', () => {
    const sorted = sortTasks([
      task('1', '健身', 'normal'),
      task('2', '数据结构作业', 'primary'),
      task('3', '组会汇报', 'secondary'),
      task('4', '整理硬盘', 'pending'),
      task('5', '读书笔记', 'normal')
    ])

    expect(sorted.map((t) => t.title)).toEqual(['数据结构作业', '组会汇报', '读书笔记', '健身', '整理硬盘'])
  })

  it('同级同名时保持稳定', () => {
    const a = task('a', '作业', 'normal')
    const b = task('b', '作业', 'normal')
    expect(sortTasks([a, b]).map((t) => t.id)).toEqual(['a', 'b'])
  })
})

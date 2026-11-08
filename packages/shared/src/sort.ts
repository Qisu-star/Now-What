import type { Priority, Task } from './types.ts'

const PRIORITY_ORDER: Record<Priority, number> = {
  primary: 0,
  secondary: 1,
  normal: 2,
  pending: 3
}

const collator = new Intl.Collator('zh', { sensitivity: 'base' })

/** 先按优先级（首要 → 次要 → 普通 → 待定），同级按名称拼音升序 */
export function sortTasks<T extends Task>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (byPriority !== 0) return byPriority
    return collator.compare(a.title, b.title)
  })
}

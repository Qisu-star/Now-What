import type { Priority, TaskInput } from './types.ts'

export const TITLE_MAX_WIDTH = 30
export const DESCRIPTION_MAX_LENGTH = 600

export const PRIORITIES: readonly Priority[] = [
  'primary',
  'secondary',
  'normal',
  'pending'
] as const

export type TaskField = 'title' | 'description' | 'priority' | 'startAt' | 'endAt'

export interface ValidationIssue {
  field: TaskField
  message: string
}

/** 显示宽度：中文全角计 2，字母、数字与常见标点计 1 */
export function textWidth(text: string): number {
  let width = 0
  for (const char of text) {
    width += /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/.test(char) ? 2 : 1
  }
  return width
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

export function validateTaskInput(input: TaskInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const title = input.title.trim()
  if (!title) {
    issues.push({ field: 'title', message: '名称不能为空' })
  } else if (textWidth(title) > TITLE_MAX_WIDTH) {
    issues.push({ field: 'title', message: `名称最多 ${TITLE_MAX_WIDTH} 字宽（中文计 2）` })
  }

  const description = input.description.trim()
  if (!description) {
    issues.push({ field: 'description', message: '描述不能为空' })
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push({ field: 'description', message: `描述最多 ${DESCRIPTION_MAX_LENGTH} 字` })
  }

  if (!PRIORITIES.includes(input.priority)) {
    issues.push({ field: 'priority', message: '优先级无效' })
  }

  if (!isValidDate(input.startAt)) {
    issues.push({ field: 'startAt', message: '开始时间格式无效' })
  }
  if (!isValidDate(input.endAt)) {
    issues.push({ field: 'endAt', message: '截止时间格式无效' })
  }
  if (
    isValidDate(input.startAt) &&
    isValidDate(input.endAt) &&
    new Date(input.endAt).getTime() < new Date(input.startAt).getTime()
  ) {
    issues.push({ field: 'endAt', message: '截止时间不能早于开始时间' })
  }

  return issues
}

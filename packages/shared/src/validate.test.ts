import { describe, expect, it } from 'vitest'
import { textWidth, validateTaskInput } from './validate.ts'
import type { TaskInput } from './types.ts'

function input(patch: Partial<TaskInput> = {}): TaskInput {
  return {
    title: '数据结构作业',
    description: '完成第三章课后习题',
    priority: 'normal',
    startAt: '2026-11-09T01:00:00Z',
    endAt: '2026-11-10T10:00:00Z',
    ...patch
  }
}

describe('textWidth', () => {
  it('中文计 2，英文与标点计 1', () => {
    expect(textWidth('数据结构')).toBe(8)
    expect(textWidth('abc')).toBe(3)
    expect(textWidth('a, b')).toBe(4)
  })

  it('混合文本累加', () => {
    expect(textWidth('作业 abc')).toBe(8)
  })
})

describe('validateTaskInput', () => {
  it('合法输入没有错误', () => {
    expect(validateTaskInput(input())).toEqual([])
  })

  it('名称不能为空', () => {
    const issues = validateTaskInput(input({ title: '   ' }))
    expect(issues).toContainEqual({ field: 'title', message: '名称不能为空' })
  })

  it('名称最多 30 字宽', () => {
    const issues = validateTaskInput(input({ title: '一'.repeat(16) }))
    expect(issues.some((i) => i.field === 'title')).toBe(true)
  })

  it('15 个中文正好可以', () => {
    const issues = validateTaskInput(input({ title: '一'.repeat(15) }))
    expect(issues).toEqual([])
  })

  it('描述不能为空且不超过 600 字', () => {
    expect(validateTaskInput(input({ description: ' ' }))).toContainEqual({
      field: 'description',
      message: '描述不能为空'
    })
    expect(
      validateTaskInput(input({ description: 'a'.repeat(601) })).some(
        (i) => i.field === 'description'
      )
    ).toBe(true)
  })

  it('截止时间不能早于开始时间', () => {
    const issues = validateTaskInput(
      input({ startAt: '2026-11-10T10:00:00Z', endAt: '2026-11-09T01:00:00Z' })
    )
    expect(issues).toContainEqual({ field: 'endAt', message: '截止时间不能早于开始时间' })
  })

  it('时间格式非法时报错', () => {
    const issues = validateTaskInput(input({ startAt: 'not-a-date' }))
    expect(issues.some((i) => i.field === 'startAt')).toBe(true)
  })
})

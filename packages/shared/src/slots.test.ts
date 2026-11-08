import { describe, expect, it } from 'vitest'
import { findSlot, hasConflict, segmentsOverlap, snapMinute } from './slots.ts'
import type { Placement } from './types.ts'

function placement(id: string, startMinute: number, endMinute: number, day = '2026-11-10'): Placement {
  return { id, taskId: 't', day, startMinute, endMinute, source: 'manual', adjusted: false }
}

describe('segmentsOverlap', () => {
  it('首尾相接不算重叠', () => {
    expect(segmentsOverlap(600, 660, 660, 720)).toBe(false)
  })

  it('相交算重叠', () => {
    expect(segmentsOverlap(600, 670, 660, 720)).toBe(true)
  })
})

describe('hasConflict', () => {
  const list = [placement('a', 600, 660), placement('b', 780, 900)]

  it('命中已占用的时段', () => {
    expect(hasConflict(list, '2026-11-10', 610, 640)).not.toBeNull()
  })

  it('忽略自己', () => {
    expect(hasConflict(list, '2026-11-10', 600, 660, 'a')).toBeNull()
  })

  it('不同日期互不影响', () => {
    expect(hasConflict(list, '2026-11-11', 600, 660)).toBeNull()
  })
})

describe('findSlot', () => {
  it('空闲时落在截止时间所在的 30 分钟格', () => {
    expect(findSlot([], '2026-11-10', 1080)).toEqual({ start: 1080, end: 1110 })
  })

  it('被占用时向更早查找', () => {
    const list = [placement('a', 1080, 1110)]
    expect(findSlot(list, '2026-11-10', 1080)).toEqual({ start: 1050, end: 1080 })
  })

  it('当天排满返回 null', () => {
    const full: Placement[] = []
    for (let m = 0; m < 1440; m += 30) full.push(placement('x' + m, m, m + 30))
    expect(findSlot(full, '2026-11-10', 720)).toBeNull()
  })

  it('截止在 23:30 以后也能落位', () => {
    expect(findSlot([], '2026-11-10', 1439)).toEqual({ start: 1410, end: 1440 })
  })
})

describe('snapMinute', () => {
  it('靠近半点时吸附', () => {
    expect(snapMinute(28)).toBe(30)
    expect(snapMinute(32)).toBe(30)
  })

  it('远离刻度时按 5 分钟取整', () => {
    expect(snapMinute(38)).toBe(40)
    expect(snapMinute(7)).toBe(5)
  })

  it('钳制在 0–1440', () => {
    expect(snapMinute(-10)).toBe(0)
    expect(snapMinute(1500)).toBe(1440)
  })
})

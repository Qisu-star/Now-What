import { describe, expect, it } from 'vitest'
import { fixedClock, isoUtc, systemClock } from './clock.ts'

describe('fixedClock', () => {
  it('始终返回同一时刻', () => {
    const clock = fixedClock('2026-11-09T21:00:00Z')
    expect(clock.now().toISOString()).toBe('2026-11-09T21:00:00.000Z')
    expect(clock.now().toISOString()).toBe(clock.now().toISOString())
  })

  it('每次返回新的 Date 实例，避免调用方改到内部状态', () => {
    const clock = fixedClock('2026-11-09T00:00:00Z')
    const first = clock.now()
    first.setFullYear(1999)
    expect(clock.now().getFullYear()).toBe(2026)
  })

  it('非法时间直接报错', () => {
    expect(() => fixedClock('not-a-date')).toThrow()
  })
})

describe('systemClock', () => {
  it('返回当前时间', () => {
    const before = Date.now()
    const value = systemClock.now().getTime()
    expect(value).toBeGreaterThanOrEqual(before)
  })
})

describe('isoUtc', () => {
  it('输出秒级精度并带 Z', () => {
    expect(isoUtc(new Date('2026-11-09T21:00:00.123Z'))).toBe('2026-11-09T21:00:00Z')
  })
})

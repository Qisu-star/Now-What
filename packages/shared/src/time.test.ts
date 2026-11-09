import { describe, expect, it } from 'vitest'
import { toLocalDayMinutes } from './time.ts'

describe('toLocalDayMinutes', () => {
  it('UTC 10:00 是本地 18:00', () => {
    expect(toLocalDayMinutes('2026-11-10T10:00:00Z')).toEqual({
      day: '2026-11-10',
      minutes: 1080
    })
  })

  it('跨天：UTC 前一天 16:30 是本地次日 00:30', () => {
    expect(toLocalDayMinutes('2026-11-09T16:30:00Z')).toEqual({
      day: '2026-11-10',
      minutes: 30
    })
  })

  it('非法时间抛错', () => {
    expect(() => toLocalDayMinutes('nope')).toThrow()
  })
})

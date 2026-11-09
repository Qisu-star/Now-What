import { describe, expect, it } from 'vitest'
import { pickCard } from './hit.ts'

// hourPx = 56：1 小时 = 56px，30 分钟 = 28px
const hourCard = { start: 600, end: 660 } // 10:00–11:00，高 56px
const nextHour = { start: 660, end: 720 } // 11:00–12:00
const halfHour = { start: 600, end: 630 } // 10:00–10:30，高 28px

describe('pickCard', () => {
  it('卡片中部触发移动', () => {
    expect(pickCard([hourCard], 588, 56)).toEqual({ index: 0, edge: 'body' })
  })

  it('靠近上边触发向上拉伸', () => {
    expect(pickCard([hourCard], 562, 56)).toEqual({ index: 0, edge: 'start' })
  })

  it('靠近下边触发向下拉伸', () => {
    expect(pickCard([hourCard], 613, 56)).toEqual({ index: 0, edge: 'end' })
  })

  it('紧贴的下一张卡片不会被上一张抢走', () => {
    expect(pickCard([hourCard, nextHour], 617, 56)).toEqual({ index: 1, edge: 'start' })
    expect(pickCard([hourCard, nextHour], 644, 56)).toEqual({ index: 1, edge: 'body' })
  })

  it('30 分钟的矮卡片只能移动，不会误触拉伸', () => {
    expect(pickCard([halfHour], 561, 56)).toEqual({ index: 0, edge: 'body' })
    expect(pickCard([halfHour], 588, 56)).toEqual({ index: 0, edge: 'body' })
  })

  it('空白处返回 null', () => {
    expect(pickCard([hourCard], 500, 56)).toBeNull()
    expect(pickCard([], 574, 56)).toBeNull()
  })
})

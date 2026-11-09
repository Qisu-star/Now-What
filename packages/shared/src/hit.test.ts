import { describe, expect, it } from 'vitest'
import { pickCard } from './hit.ts'

// hourPx = 56 → 30 分钟 = 28px
const a = { start: 600, end: 630 }
const b = { start: 630, end: 660 }
const cards = [a, b]

describe('pickCard', () => {
  it('卡片中部触发移动', () => {
    expect(pickCard(cards, 574, 56)).toEqual({ index: 0, edge: 'body' })
  })

  it('靠近上边触发向上拉伸', () => {
    expect(pickCard(cards, 561, 56)).toEqual({ index: 0, edge: 'start' })
  })

  it('靠近下边触发向下拉伸', () => {
    expect(pickCard(cards, 587, 56)).toEqual({ index: 0, edge: 'end' })
  })

  it('紧贴的下一张卡片不会被上一张抢走', () => {
    expect(pickCard(cards, 589, 56)).toEqual({ index: 1, edge: 'start' })
    expect(pickCard(cards, 600, 56)).toEqual({ index: 1, edge: 'body' })
  })

  it('空白处返回 null', () => {
    expect(pickCard(cards, 500, 56)).toBeNull()
    expect(pickCard([], 574, 56)).toBeNull()
  })

  it('单张矮卡片仍可区分拉伸与移动', () => {
    const only = [{ start: 600, end: 630 }]
    expect(pickCard(only, 562, 56)).toEqual({ index: 0, edge: 'start' })
    expect(pickCard(only, 574, 56)).toEqual({ index: 0, edge: 'body' })
    expect(pickCard(only, 586, 56)).toEqual({ index: 0, edge: 'end' })
  })
})

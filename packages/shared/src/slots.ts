import type { Placement } from './types.ts'

export const MINUTES_PER_DAY = 1440

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 左闭右开区间，首尾相接不算重叠 */
export function segmentsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function hasConflict(
  placements: readonly Placement[],
  day: string,
  start: number,
  end: number,
  ignoreId: string | null = null
): Placement | null {
  for (const placement of placements) {
    if (placement.day !== day || placement.id === ignoreId) continue
    if (segmentsOverlap(start, end, placement.startMinute, placement.endMinute)) {
      return placement
    }
  }
  return null
}

/** 先按 5 分钟取整，距 30 分钟刻度不超过 3 分钟时吸附 */
export function snapMinute(minutes: number): number {
  const rounded = Math.round(minutes / 5) * 5
  const nearestHalf = Math.round(rounded / 30) * 30
  const snapped = Math.abs(rounded - nearestHalf) <= 3 ? nearestHalf : rounded
  return clamp(snapped, 0, MINUTES_PER_DAY)
}

export interface Slot {
  start: number
  end: number
}

/**
 * 自动落位：优先截止时间所在的 30 分钟格；
 * 被占用则向更早查找，当天更早没有空位再向更晚查找；当天排满返回 null。
 */
export function findSlot(
  placements: readonly Placement[],
  day: string,
  deadlineMinutes: number,
  duration = 30
): Slot | null {
  const base = Math.min(
    Math.floor(deadlineMinutes / 30) * 30,
    MINUTES_PER_DAY - duration
  )

  const candidates: number[] = []
  for (let start = base; start >= 0; start -= 30) candidates.push(start)
  for (let start = base + 30; start + duration <= MINUTES_PER_DAY; start += 30) {
    candidates.push(start)
  }

  for (const start of candidates) {
    if (!hasConflict(placements, day, start, start + duration)) {
      return { start, end: start + duration }
    }
  }
  return null
}

/** 可注入的时钟：业务代码不直接调用 new Date()，测试可固定时间 */
export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date()
}

/** 固定时钟，用于测试与演示 */
export function fixedClock(iso: string): Clock {
  const fixed = new Date(iso)
  if (Number.isNaN(fixed.getTime())) {
    throw new Error(`invalid iso datetime: ${iso}`)
  }
  return { now: () => new Date(fixed.getTime()) }
}

/** 统一输出秒级精度的 ISO 8601 UTC 字符串 */
export function isoUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

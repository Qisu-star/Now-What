/** 本期单时区假设：UTC+8（见 ADR-002） */
export const APP_UTC_OFFSET_MINUTES = 480

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 把 UTC 时刻换算成「本地日期 + 当天分钟数」。
 * 固定 +08 偏移，结果不依赖运行机器的时区。
 */
export function toLocalDayMinutes(iso: string): { day: string; minutes: number } {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    throw new Error(`invalid iso datetime: ${iso}`)
  }
  const local = new Date(timestamp + APP_UTC_OFFSET_MINUTES * 60_000)
  const day = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  return { day, minutes }
}

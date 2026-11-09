import { toLocalDayMinutes } from '@nowwhat/shared'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function localParts(iso: string): { date: string; time: string; minutes: number } {
  const { day, minutes } = toLocalDayMinutes(iso)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return { date: day, time: `${hh}:${mm}`, minutes }
}

/** 11/10 周二 18:00 */
export function fmtDateTime(iso: string): string {
  const { date, time } = localParts(iso)
  const [year, month, day] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay()]
  return `${month}/${day} ${weekday} ${time}`
}

export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

/** 11/10 周二 14:00–16:00 */
export function fmtPlacement(day: string, startMinute: number, endMinute: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1)).getUTCDay()]
  const hhmm = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return `${month}/${date} ${weekday} ${hhmm(startMinute)}–${hhmm(endMinute)}`
}

export function isOverdue(iso: string, now: number = Date.now()): boolean {
  return Date.parse(iso) < now
}

/** 当前本地日期，用于表单默认值 */
export function todayLocal(): string {
  return toLocalDayMinutes(new Date().toISOString()).day
}

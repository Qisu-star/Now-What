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

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function utcOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1))
}

export function addDays(day: string, offset: number): string {
  const date = utcOf(day)
  date.setUTCDate(date.getUTCDate() + offset)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** 周一为一周起点 */
export function startOfWeek(day: string): string {
  const offset = (utcOf(day).getUTCDay() + 6) % 7
  return addDays(day, -offset)
}

export function weekDays(day: string): string[] {
  const start = startOfWeek(day)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function weekdayShort(day: string): string {
  return WEEKDAYS[utcOf(day).getUTCDay()] ?? ''
}

/** 0 = 周一 … 6 = 周日 */
export function weekdayIndex(day: string): number {
  return (utcOf(day).getUTCDay() + 6) % 7
}

export function dayNumber(day: string): number {
  return utcOf(day).getUTCDate()
}

/** 11月9日 */
export function monthDay(day: string): string {
  const date = utcOf(day)
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

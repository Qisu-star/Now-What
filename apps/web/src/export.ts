import * as XLSX from 'xlsx'
import { toPng } from 'html-to-image'
import type { Placement, Task } from '@nowwhat/shared'
import {
  addDays,
  dayLabel,
  minutesToTime,
  monthDay,
  monthGridDays,
  monthLabel,
  monthStart,
  startOfWeek,
  weekdayShort,
  weekDays
} from './format'
import { PRIORITY_META } from './theme'

export type ViewId = 'day' | 'week' | 'month'

interface SlotEvent {
  placement: Placement
  task: Task
}

function eventsOf(tasks: Task[], placements: Placement[], day: string): SlotEvent[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const result: SlotEvent[] = []

  for (const placement of placements) {
    if (placement.day !== day) continue
    const task = byId.get(placement.taskId)
    if (task) result.push({ placement, task })
  }

  return result.sort((a, b) => a.placement.startMinute - b.placement.startMinute)
}

export function exportRangeLabel(view: ViewId, anchor: string): string {
  if (view === 'day') return dayLabel(anchor)
  if (view === 'month') return monthLabel(anchor)
  const start = startOfWeek(anchor)
  return `${monthDay(start)}–${monthDay(addDays(start, 6))}`
}

function fileName(view: ViewId, anchor: string, extension: string): string {
  const label = view === 'day' ? '日' : view === 'week' ? '周' : '月'
  const range = exportRangeLabel(view, anchor).replace(/[／/年月日\s]/g, '-').replace(/-+/g, '-')
  return `Now-What-${label}-${range}.${extension}`
}

function buildTimeGrid(view: ViewId, anchor: string, tasks: Task[], placements: Placement[]) {
  const days = view === 'day' ? [anchor] : weekDays(anchor)
  const header = ['时间', ...days.map((day) => `${monthDay(day)} ${weekdayShort(day)}`)]
  const rows: (string | number)[][] = [header]

  for (let slot = 0; slot < 48; slot++) {
    const start = slot * 30
    const row: (string | number)[] = [minutesToTime(start)]
    for (const day of days) {
      const cell = eventsOf(tasks, placements, day)
        .filter((item) => item.placement.startMinute === start)
        .map(
          (item) =>
            `${item.task.title} ${minutesToTime(item.placement.startMinute)}–${minutesToTime(item.placement.endMinute)}`
        )
        .join('\n')
      row.push(cell)
    }
    rows.push(row)
  }

  return { days, rows }
}

export function exportXlsx(
  view: ViewId,
  anchor: string,
  tasks: Task[],
  placements: Placement[]
): void {
  const workbook = XLSX.utils.book_new()

  if (view === 'month') {
    const rows: (string | number)[][] = [['日期', '时间', '事务', '优先级']]
    for (const day of monthGridDays(monthStart(anchor))) {
      for (const item of eventsOf(tasks, placements, day)) {
        rows.push([
          `${monthDay(day)} ${weekdayShort(day)}`,
          `${minutesToTime(item.placement.startMinute)}–${minutesToTime(item.placement.endMinute)}`,
          item.task.title,
          PRIORITY_META[item.task.priority].label
        ])
      }
    }
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(workbook, sheet, '月视图')
  } else {
    const { rows } = buildTimeGrid(view, anchor, tasks, placements)
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = [{ wch: 8 }, ...Array(7).fill({ wch: 26 })]
    XLSX.utils.book_append_sheet(workbook, sheet, view === 'day' ? '日视图' : '周视图')
  }

  XLSX.writeFile(workbook, fileName(view, anchor, 'xlsx'))
}

function downloadDataUrl(dataUrl: string, name: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * 导出当前视图为图片。
 * 时间网格在滚动容器里，先把容器撑到完整高度再截图，避免只截到可见区域。
 */
export async function exportPng(
  node: HTMLElement,
  view: ViewId,
  anchor: string
): Promise<void> {
  const scroller = node.querySelector<HTMLElement>('[data-export-scroll]')
  const restores: (() => void)[] = []

  if (scroller) {
    const previousHeight = scroller.style.height
    const previousOverflow = scroller.style.overflowY
    scroller.style.height = `${scroller.scrollHeight}px`
    scroller.style.overflowY = 'visible'
    restores.push(() => {
      scroller.style.height = previousHeight
      scroller.style.overflowY = previousOverflow
    })
  }

  const previousNodeHeight = node.style.height
  const previousFlex = node.style.flex
  node.style.height = 'auto'
  node.style.flex = 'none'
  restores.push(() => {
    node.style.height = previousNodeHeight
    node.style.flex = previousFlex
  })

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true
    })
    downloadDataUrl(dataUrl, fileName(view, anchor, 'png'))
  } finally {
    for (const restore of restores.reverse()) restore()
  }
}

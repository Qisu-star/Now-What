import * as XLSX from 'xlsx'
import { toPng } from 'html-to-image'
import type { Placement, Task } from '@nowwhat/shared'
import {
  addDays,
  fmtDateTime,
  fmtPlacement,
  minutesToTime,
  monthDay,
  monthGridDays,
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

function rangeKey(view: ViewId, anchor: string): string {
  if (view === 'day') return anchor
  if (view === 'month') return anchor.slice(0, 7)
  const start = startOfWeek(anchor)
  return `${start}_${addDays(start, 6)}`
}

function fileName(view: ViewId, anchor: string, extension: string): string {
  const label = view === 'day' ? '日' : view === 'week' ? '周' : '月'
  return `Now-What-${label}-${rangeKey(view, anchor)}.${extension}`
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

  const taskRows: (string | number)[][] = [['名称', '描述', '截止时间', '优先级', '计划时段']]
  const ordered = [...tasks].sort((a, b) => a.endAt.localeCompare(b.endAt))

  for (const task of ordered) {
    const ranges = placements
      .filter((placement) => placement.taskId === task.id)
      .map((placement) =>
        fmtPlacement(placement.day, placement.startMinute, placement.endMinute)
      )
      .join('\n')

    taskRows.push([
      task.title,
      task.description,
      fmtDateTime(task.endAt),
      PRIORITY_META[task.priority].label,
      ranges
    ])
  }

  const taskSheet = XLSX.utils.aoa_to_sheet(taskRows)
  taskSheet['!cols'] = [{ wch: 24 }, { wch: 50 }, { wch: 18 }, { wch: 8 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(workbook, taskSheet, '事务清单')

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
 * 时间网格在滚动容器里，先按真实宽度固定尺寸、把容器撑到完整高度，再整块截图。
 */
export async function exportPng(
  node: HTMLElement,
  view: ViewId,
  anchor: string
): Promise<void> {
  const scroller = node.querySelector<HTMLElement>('[data-export-scroll]')
  const restores: (() => void)[] = []

  const rect = node.getBoundingClientRect()
  const width = Math.max(320, Math.ceil(rect.width))
  let height = Math.ceil(rect.height)

  if (scroller) {
    const scrollerHeight = scroller.scrollHeight
    const headerHeight = rect.height - scroller.getBoundingClientRect().height
    height = Math.ceil(headerHeight + scrollerHeight)

    const previous = scroller.style.cssText
    scroller.style.height = `${scrollerHeight}px`
    scroller.style.overflow = 'visible'
    restores.push(() => {
      scroller.style.cssText = previous
    })
  }

  const previousNode = node.style.cssText
  node.style.width = `${width}px`
  node.style.height = `${height}px`
  node.style.flex = '0 0 auto'
  node.style.overflow = 'visible'
  restores.push(() => {
    node.style.cssText = previousNode
  })

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

  try {
    const dataUrl = await toPng(node, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        margin: '0'
      }
    })
    downloadDataUrl(dataUrl, fileName(view, anchor, 'png'))
  } finally {
    for (const restore of restores.reverse()) restore()
  }
}
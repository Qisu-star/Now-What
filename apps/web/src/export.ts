import * as XLSX from 'xlsx'
import { toPng } from 'html-to-image'
import type { Placement, Task } from '@nowwhat/shared'
import {
  addDays,
  fmtDateTime,
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

interface ViewEvent {
  placement: Placement
  task: Task
}

function eventsOf(tasks: Task[], placements: Placement[], day: string): ViewEvent[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const result: ViewEvent[] = []

  for (const placement of placements) {
    if (placement.day !== day) continue
    const task = byId.get(placement.taskId)
    if (task) result.push({ placement, task })
  }

  return result.sort((a, b) => a.placement.startMinute - b.placement.startMinute)
}

function viewLabel(view: ViewId): string {
  return view === 'day' ? '日视图' : view === 'week' ? '周视图' : '月视图'
}

function fullDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${year}年${month}月${date}日 ${weekdayShort(day)}`
}

function rangeText(view: ViewId, anchor: string): string {
  if (view === 'day') return fullDay(anchor)
  if (view === 'month') {
    return `${anchor.slice(0, 4)}年${Number(anchor.slice(5, 7))}月`
  }
  const start = startOfWeek(anchor)
  return `${fullDay(start)} – ${fullDay(addDays(start, 6))}`
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

/** 每个计划时段一行，含描述与截止时间 */
function detailRows(
  days: string[],
  tasks: Task[],
  placements: Placement[]
): (string | number)[][] {
  const rows: (string | number)[][] = [
    ['日期', '开始', '结束', '名称', '描述', '截止时间', '优先级']
  ]

  for (const day of days) {
    for (const item of eventsOf(tasks, placements, day)) {
      rows.push([
        `${monthDay(day)} ${weekdayShort(day)}`,
        minutesToTime(item.placement.startMinute),
        minutesToTime(item.placement.endMinute),
        item.task.title,
        item.task.description,
        fmtDateTime(item.task.endAt),
        PRIORITY_META[item.task.priority].label
      ])
    }
  }

  return rows
}

function buildTimeGrid(
  view: ViewId,
  anchor: string,
  tasks: Task[],
  placements: Placement[]
): XLSX.WorkSheet {
  const days = view === 'day' ? [anchor] : weekDays(anchor)
  const header = ['时间', ...days.map((day) => `${monthDay(day)} ${weekdayShort(day)}`)]
  const rows: (string | number)[][] = [header]
  const merges: XLSX.Range[] = []

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

  days.forEach((day, dayIndex) => {
    for (const item of eventsOf(tasks, placements, day)) {
      const startSlot = Math.floor(item.placement.startMinute / 30)
      const endSlot = Math.ceil(item.placement.endMinute / 30)
      if (endSlot - startSlot > 1) {
        merges.push({
          s: { r: startSlot + 1, c: dayIndex + 1 },
          e: { r: endSlot, c: dayIndex + 1 }
        })
      }
    }
  })

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 8 }, ...Array(7).fill({ wch: 26 })]
  sheet['!merges'] = merges
  return sheet
}

export function exportXlsx(
  view: ViewId,
  anchor: string,
  tasks: Task[],
  placements: Placement[]
): void {
  const workbook = XLSX.utils.book_new()

  if (view === 'month') {
    const rows = detailRows(monthGridDays(monthStart(anchor)), tasks, placements)
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = [
      { wch: 16 },
      { wch: 8 },
      { wch: 8 },
      { wch: 26 },
      { wch: 50 },
      { wch: 18 },
      { wch: 8 }
    ]
    XLSX.utils.book_append_sheet(workbook, sheet, '月视图')
  } else {
    const grid = buildTimeGrid(view, anchor, tasks, placements)
    XLSX.utils.book_append_sheet(workbook, grid, '时间网格')

    const days = view === 'day' ? [anchor] : weekDays(anchor)
    const detail = detailRows(days, tasks, placements)
    const detailSheet = XLSX.utils.aoa_to_sheet(detail)
    detailSheet['!cols'] = [
      { wch: 16 },
      { wch: 8 },
      { wch: 8 },
      { wch: 26 },
      { wch: 50 },
      { wch: 18 },
      { wch: 8 }
    ]
    XLSX.utils.book_append_sheet(workbook, detailSheet, '事务明细')
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

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = dataUrl
  })
}

/** 给截图加一条标题栏，补上视图类型与完整日期范围 */
async function addTitleBar(dataUrl: string, view: ViewId, anchor: string): Promise<string> {
  const image = await loadImage(dataUrl)
  const barHeight = 128
  const padding = 32

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height + barHeight
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#0f172a'
  context.font = '600 40px "Microsoft YaHei", system-ui, sans-serif'
  context.fillText(`Now What · ${viewLabel(view)}`, padding, 52)

  context.fillStyle = '#64748b'
  context.font = '28px "Microsoft YaHei", system-ui, sans-serif'
  context.fillText(rangeText(view, anchor), padding, 96)

  context.strokeStyle = '#e2e8f0'
  context.beginPath()
  context.moveTo(0, barHeight - 1)
  context.lineTo(canvas.width, barHeight - 1)
  context.stroke()

  context.drawImage(image, 0, barHeight)
  return canvas.toDataURL('image/png')
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
    const titled = await addTitleBar(dataUrl, view, anchor)
    downloadDataUrl(titled, fileName(view, anchor, 'png'))
  } finally {
    for (const restore of restores.reverse()) restore()
  }
}

import { reactive } from 'vue'
import { hasConflict, snapMinute, type Placement, type Task } from '@nowwhat/shared'

export const HOUR_PX = 56

export type DragMode = 'create' | 'move' | 'resize-start' | 'resize-end'

export interface DragPayload {
  mode: DragMode
  taskId: string
  placementId: string | null
  day: string
  start: number
  end: number
  valid: boolean
}

export const drag = reactive({
  active: false,
  day: '',
  start: 0,
  end: 30,
  /** 本次拖拽的固定时长（分钟）：移动时不随时长变化 */
  duration: 60,
  valid: true,
  x: 0,
  y: 0
})

/** 拖拽刚结束时抑制一次 click，避免误开详情 */
export const flags = reactive({ suppressClick: false })

interface Column {
  day: string
  el: HTMLElement
}

interface Pending {
  mode: DragMode
  taskId: string
  placementId: string | null
  startX: number
  startY: number
  grab: number
  duration: number
  origStart: number
  origEnd: number
}

let columns: Column[] = []
let pending: Pending | null = null
let suppressTimer = 0

let getPlacements: () => Placement[] = () => []
let onDrop: (payload: DragPayload) => void = () => {}

export function configureDrag(options: {
  getPlacements: () => Placement[]
  onDrop: (payload: DragPayload) => void
}): void {
  getPlacements = options.getPlacements
  onDrop = options.onDrop
}

export function setDragColumns(list: Column[]): void {
  columns = list
}

function rectOf(day: string): DOMRect | null {
  const column = columns.find((item) => item.day === day)
  return column ? column.el.getBoundingClientRect() : null
}

function minutesAt(clientY: number, rect: DOMRect): number {
  const ratio = (clientY - rect.top) / HOUR_PX
  return Math.max(0, Math.min(1440, ratio * 60))
}

function columnAt(clientX: number): Column | null {
  let best: Column | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const column of columns) {
    const rect = column.el.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) return column
    const distance = clientX < rect.left ? rect.left - clientX : clientX - rect.right
    if (distance < bestDistance) {
      bestDistance = distance
      best = column
    }
  }

  return bestDistance <= 120 ? best : null
}

function listen(): void {
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}

function unlisten(): void {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
}

/** 从右侧列表拖入：默认 30 分钟 */
export function beginTaskDrag(task: Task, event: PointerEvent): void {
  if (event.button !== 0) return
  pending = {
    mode: 'create',
    taskId: task.id,
    placementId: null,
    startX: event.clientX,
    startY: event.clientY,
    grab: 30,
    duration: 60,
    origStart: 0,
    origEnd: 60
  }
  listen()
}

/** 拖动表内已有卡片，或拖动它的上下边缘 */
export function beginPlacementDrag(
  placement: Placement,
  mode: 'move' | 'resize-start' | 'resize-end',
  event: PointerEvent
): void {
  if (event.button !== 0) return

  const rect = rectOf(placement.day)
  const grab = rect ? minutesAt(event.clientY, rect) - placement.startMinute : 0

  pending = {
    mode,
    taskId: placement.taskId,
    placementId: placement.id,
    startX: event.clientX,
    startY: event.clientY,
    grab: Math.max(0, grab),
    duration: placement.endMinute - placement.startMinute,
    origStart: placement.startMinute,
    origEnd: placement.endMinute
  }
  listen()
}

function onMove(event: PointerEvent): void {
  if (!pending) return

  const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
  if (!drag.active && moved < 4) return

  const column = columnAt(event.clientX)
  if (!column) {
    if (drag.active) drag.valid = false
    return
  }

  const rect = column.el.getBoundingClientRect()
  const at = minutesAt(event.clientY, rect)

  let start = pending.origStart
  let end = pending.origEnd

  if (pending.mode === 'create') {
    start = snapMinute(at - pending.duration / 2)
    if (start + pending.duration > 1440) start = 1440 - pending.duration
    if (start < 0) start = 0
    end = start + pending.duration
  } else if (pending.mode === 'move') {
    start = snapMinute(at - pending.grab)
    if (start < 0) start = 0
    if (start + pending.duration > 1440) start = 1440 - pending.duration
    end = start + pending.duration
  } else if (pending.mode === 'resize-start') {
    start = Math.min(snapMinute(at), pending.origEnd - 5)
    end = pending.origEnd
  } else {
    end = Math.max(snapMinute(at), pending.origStart + 5)
    start = pending.origStart
  }

  drag.active = true
  drag.day = column.day
  drag.start = start
  drag.end = end
  drag.duration = end - start
  drag.x = event.clientX
  drag.y = event.clientY
  drag.valid = !hasConflict(getPlacements(), column.day, start, end, pending.placementId)
}

function onUp(): void {
  if (pending && drag.active) {
    onDrop({
      mode: pending.mode,
      taskId: pending.taskId,
      placementId: pending.placementId,
      day: drag.day,
      start: drag.start,
      end: drag.end,
      valid: drag.valid
    })

    flags.suppressClick = true
    window.clearTimeout(suppressTimer)
    suppressTimer = window.setTimeout(() => {
      flags.suppressClick = false
    }, 60)
  }

  cleanup()
}

function onCancel(): void {
  cleanup()
}

function cleanup(): void {
  pending = null
  drag.active = false
  drag.valid = true
  unlisten()
}

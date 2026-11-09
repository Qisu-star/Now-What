export type Priority = 'primary' | 'secondary' | 'normal' | 'pending'
export type TaskStatus = 'active' | 'archived'
export type PlacementSource = 'auto' | 'manual'

export interface TaskInput {
  title: string
  description: string
  priority: Priority
  startAt: string
  endAt: string
}

export interface Task extends TaskInput {
  id: string
  color: number
  status: TaskStatus
  completedAt: string | null
  archivedAt: string | null
  note: string
  createdAt: string
  updatedAt: string
}

export interface Placement {
  id: string
  taskId: string
  day: string
  startMinute: number
  endMinute: number
  source: PlacementSource
  adjusted: boolean
}
export interface Attachment {
  id: string
  taskId: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
}

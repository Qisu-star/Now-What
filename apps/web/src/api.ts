import type { Attachment, Placement, Task, TaskInput } from '@nowwhat/shared'

export interface Health {
  status: 'ok'
  db: 'ok'
  time: string
}

export interface ValidationDetail {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly details: ValidationDetail[]

  constructor(status: number, message: string, details: ValidationDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // 只有带请求体时才声明 content-type：否则 Fastify 会把空的 JSON 体判为 400
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && init.body !== null) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers })

  if (response.status === 204) {
    return undefined as T
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (body as { error?: { message?: string; details?: ValidationDetail[] } } | null)
      ?.error
    throw new ApiError(
      response.status,
      error?.message ?? `HTTP ${response.status}`,
      error?.details ?? []
    )
  }

  return body as T
}

export function getHealth(): Promise<Health> {
  return request<Health>('/api/v1/health')
}

export interface TaskWrite {
  task: Task
  placement: Placement | null
}

export interface TaskDetail {
  task: Task
  placements: Placement[]
}

export async function fetchTasks(status: 'active' | 'archived' = 'active'): Promise<Task[]> {
  const body = await request<{ tasks: Task[] }>(`/api/v1/tasks?status=${status}`)
  return body.tasks
}

export function fetchTask(id: string): Promise<TaskDetail> {
  return request<TaskDetail>(`/api/v1/tasks/${id}`)
}

export function createTask(input: TaskInput): Promise<TaskWrite> {
  return request<TaskWrite>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function updateTask(id: string, patch: Partial<TaskInput>): Promise<TaskWrite> {
  return request<TaskWrite>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  })
}

export function archiveTask(
  id: string,
  input: { completedAt?: string; note?: string } = {}
): Promise<{ task: Task; released: number }> {
  return request<{ task: Task; released: number }>(`/api/v1/tasks/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function updateArchiveInfo(
  id: string,
  input: { completedAt?: string; note?: string }
): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  })
}

export function unarchiveTask(id: string): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/api/v1/tasks/${id}/unarchive`, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' })
}

export interface PlacementInput {
  taskId: string
  day: string
  startMinute: number
  endMinute: number
}

export async function fetchPlacements(from: string, to: string): Promise<Placement[]> {
  const body = await request<{ placements: Placement[] }>(
    `/api/v1/placements?from=${from}&to=${to}`
  )
  return body.placements
}

export function createPlacement(input: PlacementInput): Promise<{ placement: Placement }> {
  return request<{ placement: Placement }>('/api/v1/placements', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function updatePlacement(
  id: string,
  patch: Partial<Pick<PlacementInput, 'day' | 'startMinute' | 'endMinute'>>
): Promise<{ placement: Placement }> {
  return request<{ placement: Placement }>(`/api/v1/placements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  })
}

export function deletePlacement(id: string): Promise<void> {
  return request<void>(`/api/v1/placements/${id}`, { method: 'DELETE' })
}
export async function fetchAttachments(taskId: string): Promise<Attachment[]> {
  const body = await request<{ attachments: Attachment[] }>(
    `/api/v1/attachments?taskId=${encodeURIComponent(taskId)}`
  )
  return body.attachments
}

export function attachmentUrl(id: string): string {
  return `/api/v1/attachments/${id}/content`
}

export async function uploadAttachment(taskId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('taskId', taskId)
  form.append('file', file)

  // FormData 必须让浏览器自己带 boundary，不能设置 content-type
  const response = await fetch('/api/v1/attachments', { method: 'POST', body: form })
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (body as { error?: { message?: string } } | null)?.error
    throw new ApiError(response.status, error?.message ?? `HTTP ${response.status}`)
  }

  return (body as { attachment: Attachment }).attachment
}

export function deleteAttachment(id: string): Promise<void> {
  return request<void>(`/api/v1/attachments/${id}`, { method: 'DELETE' })
}

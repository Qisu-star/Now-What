import type { Placement, Task, TaskInput } from '@nowwhat/shared'

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
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init
  })

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

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' })
}

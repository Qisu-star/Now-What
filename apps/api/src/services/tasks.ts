import { randomUUID } from 'node:crypto'
import { and, count, eq } from 'drizzle-orm'
import {
  findSlot,
  isoUtc,
  toLocalDayMinutes,
  validateTaskInput,
  type Clock,
  type Placement,
  type Task,
  type TaskInput,
  type ValidationIssue
} from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import { placements, tasks } from '../db/schema.ts'

export interface TaskWrite {
  task: Task
  placement: Placement | null
}

export type WriteResult =
  | { ok: true; value: TaskWrite }
  | { ok: false; issues: ValidationIssue[] }

export function listTasks(db: AppDb, status: Task['status']): Task[] {
  return db.select().from(tasks).where(eq(tasks.status, status)).all()
}

export function getTaskDetail(
  db: AppDb,
  id: string
): { task: Task; placements: Placement[] } | null {
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) return null
  const rows = db.select().from(placements).where(eq(placements.taskId, id)).all()
  return { task, placements: rows }
}

function placementsOfDay(db: AppDb, day: string): Placement[] {
  return db.select().from(placements).where(eq(placements.day, day)).all()
}

function insertAutoPlacement(
  db: AppDb,
  taskId: string,
  endAt: string,
  duration = 60
): Placement | null {
  const { day, minutes } = toLocalDayMinutes(endAt)
  const slot = findSlot(placementsOfDay(db, day), day, minutes, duration)
  if (!slot) return null

  const placement: Placement = {
    id: randomUUID(),
    taskId,
    day,
    startMinute: slot.start,
    endMinute: slot.end,
    source: 'auto',
    adjusted: false
  }
  db.insert(placements).values(placement).run()
  return placement
}

export function createTask(db: AppDb, clock: Clock, input: TaskInput): WriteResult {
  const issues = validateTaskInput(input)
  if (issues.length > 0) return { ok: false, issues }

  const now = isoUtc(clock.now())
  const id = randomUUID()
  const total = db.select({ value: count() }).from(tasks).get()?.value ?? 0

  const task: Task = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    startAt: input.startAt,
    endAt: input.endAt,
    color: total % 8,
    status: 'active',
    completedAt: null,
    archivedAt: null,
    note: '',
    createdAt: now,
    updatedAt: now
  }

  db.insert(tasks).values(task).run()
  const placement = insertAutoPlacement(db, id, task.endAt)

  return { ok: true, value: { task, placement } }
}

export function updateTask(
  db: AppDb,
  clock: Clock,
  id: string,
  patch: Partial<TaskInput>
): WriteResult | null {
  const existing = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!existing) return null

  const merged: TaskInput = {
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    priority: patch.priority ?? existing.priority,
    startAt: patch.startAt ?? existing.startAt,
    endAt: patch.endAt ?? existing.endAt
  }

  const issues = validateTaskInput(merged)
  if (issues.length > 0) return { ok: false, issues }

  db.update(tasks)
    .set({
      title: merged.title.trim(),
      description: merged.description.trim(),
      priority: merged.priority,
      startAt: merged.startAt,
      endAt: merged.endAt,
      updatedAt: isoUtc(clock.now())
    })
    .where(eq(tasks.id, id))
    .run()

  let placement: Placement | null = null

  if (merged.endAt !== existing.endAt) {
    const auto = db
      .select()
      .from(placements)
      .where(
        and(
          eq(placements.taskId, id),
          eq(placements.source, 'auto'),
          eq(placements.adjusted, false)
        )
      )
      .get()

    if (auto) {
      const duration = auto.endMinute - auto.startMinute
      const { day, minutes } = toLocalDayMinutes(merged.endAt)
      const others = placementsOfDay(db, day).filter((row) => row.id !== auto.id)
      const slot = findSlot(others, day, minutes, duration)
      if (slot) {
        db.update(placements)
          .set({ day, startMinute: slot.start, endMinute: slot.end })
          .where(eq(placements.id, auto.id))
          .run()
        placement = { ...auto, day, startMinute: slot.start, endMinute: slot.end }
      }
    }
  }

  const task = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) return null

  return { ok: true, value: { task, placement } }
}

export function deleteTask(db: AppDb, id: string): boolean {
  const result = db.delete(tasks).where(eq(tasks.id, id)).run()
  return result.changes > 0
}

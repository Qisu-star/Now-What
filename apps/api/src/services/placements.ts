import { randomUUID } from 'node:crypto'
import { and, eq, gte, lte } from 'drizzle-orm'
import { hasConflict, type Placement } from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import { placements, tasks } from '../db/schema.ts'

export interface PlacementInput {
  taskId: string
  day: string
  startMinute: number
  endMinute: number
}

export interface PlacementPatch {
  day?: string
  startMinute?: number
  endMinute?: number
}

export interface Issue {
  field: string
  message: string
}

export type CreateResult =
  | { ok: true; placement: Placement }
  | { ok: false; code: 'VALIDATION'; issues: Issue[] }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' }

export type UpdateResult =
  | { ok: true; placement: Placement }
  | { ok: false; code: 'VALIDATION'; issues: Issue[] }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' }
  | null

function validate(input: PlacementInput): Issue[] {
  const issues: Issue[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    issues.push({ field: 'day', message: '日期格式应为 YYYY-MM-DD' })
  }
  if (!Number.isInteger(input.startMinute) || !Number.isInteger(input.endMinute)) {
    issues.push({ field: 'startMinute', message: '时间必须是整数分钟' })
    return issues
  }
  if (input.startMinute < 0 || input.endMinute > 1440) {
    issues.push({ field: 'startMinute', message: '时间必须在 00:00–24:00 之间' })
  }
  if (input.endMinute <= input.startMinute) {
    issues.push({ field: 'endMinute', message: '结束时间必须晚于开始时间' })
  }
  return issues
}

function dayPlacements(db: AppDb, day: string): Placement[] {
  return db.select().from(placements).where(eq(placements.day, day)).all()
}

export function listPlacements(db: AppDb, from: string, to: string): Placement[] {
  return db
    .select()
    .from(placements)
    .where(and(gte(placements.day, from), lte(placements.day, to)))
    .all()
}

export function createPlacement(db: AppDb, input: PlacementInput): CreateResult {
  const issues = validate(input)
  if (issues.length > 0) return { ok: false, code: 'VALIDATION', issues }

  const task = db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()
  if (!task) return { ok: false, code: 'NOT_FOUND' }

  if (hasConflict(dayPlacements(db, input.day), input.day, input.startMinute, input.endMinute)) {
    return { ok: false, code: 'CONFLICT' }
  }

  const placement: Placement = {
    id: randomUUID(),
    taskId: input.taskId,
    day: input.day,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    source: 'manual',
    adjusted: true
  }
  db.insert(placements).values(placement).run()
  return { ok: true, placement }
}

export function updatePlacementById(
  db: AppDb,
  id: string,
  patch: PlacementPatch
): UpdateResult {
  const existing = db.select().from(placements).where(eq(placements.id, id)).get()
  if (!existing) return null

  const merged: PlacementInput = {
    taskId: existing.taskId,
    day: patch.day ?? existing.day,
    startMinute: patch.startMinute ?? existing.startMinute,
    endMinute: patch.endMinute ?? existing.endMinute
  }

  const issues = validate(merged)
  if (issues.length > 0) return { ok: false, code: 'VALIDATION', issues }

  if (
    hasConflict(
      dayPlacements(db, merged.day),
      merged.day,
      merged.startMinute,
      merged.endMinute,
      id
    )
  ) {
    return { ok: false, code: 'CONFLICT' }
  }

  db.update(placements)
    .set({
      day: merged.day,
      startMinute: merged.startMinute,
      endMinute: merged.endMinute,
      adjusted: true
    })
    .where(eq(placements.id, id))
    .run()

  return { ok: true, placement: { ...existing, ...merged, adjusted: true } }
}

export function deletePlacement(db: AppDb, id: string): boolean {
  const result = db.delete(placements).where(eq(placements.id, id)).run()
  return result.changes > 0
}

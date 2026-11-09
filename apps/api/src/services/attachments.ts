import { randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { isoUtc, type Attachment, type Clock } from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import { attachments, tasks } from '../db/schema.ts'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.md', '.docx', '.pdf', '.jpg', '.jpeg', '.png']

export function filePath(uploadDir: string, taskId: string, id: string, filename: string): string {
  return path.join(uploadDir, taskId, `${id}${path.extname(filename).toLowerCase()}`)
}

export function listAttachments(db: AppDb, taskId: string): Attachment[] {
  return db.select().from(attachments).where(eq(attachments.taskId, taskId)).all()
}

export function getAttachment(db: AppDb, id: string): Attachment | undefined {
  return db.select().from(attachments).where(eq(attachments.id, id)).get()
}

export type SaveResult =
  | { ok: true; attachment: Attachment }
  | { ok: false; code: 'NOT_FOUND' | 'UNSUPPORTED' | 'TOO_LARGE' }

export interface SaveParams {
  taskId: string
  filename: string
  mimeType: string
  data: Buffer
}

export function saveAttachment(
  db: AppDb,
  clock: Clock,
  uploadDir: string,
  params: SaveParams
): SaveResult {
  const task = db.select().from(tasks).where(eq(tasks.id, params.taskId)).get()
  if (!task) return { ok: false, code: 'NOT_FOUND' }

  const ext = path.extname(params.filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) return { ok: false, code: 'UNSUPPORTED' }
  if (params.data.length > MAX_ATTACHMENT_BYTES) return { ok: false, code: 'TOO_LARGE' }

  const id = randomUUID()
  const attachment: Attachment = {
    id,
    taskId: params.taskId,
    filename: params.filename,
    mimeType: params.mimeType || 'application/octet-stream',
    size: params.data.length,
    createdAt: isoUtc(clock.now())
  }

  const target = filePath(uploadDir, params.taskId, id, params.filename)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, params.data)
  db.insert(attachments).values(attachment).run()

  return { ok: true, attachment }
}

export function deleteAttachment(db: AppDb, uploadDir: string, id: string): boolean {
  const row = getAttachment(db, id)
  if (!row) return false

  try {
    unlinkSync(filePath(uploadDir, row.taskId, row.id, row.filename))
  } catch {
    // 文件可能已被清理，忽略
  }

  db.delete(attachments).where(eq(attachments.id, id)).run()
  return true
}

/** 删除事务前清理附件文件；记录由外键级联删除 */
export function removeTaskFiles(db: AppDb, uploadDir: string, taskId: string): void {
  for (const row of listAttachments(db, taskId)) {
    try {
      unlinkSync(filePath(uploadDir, row.taskId, row.id, row.filename))
    } catch {
      // 忽略缺失文件
    }
  }
}

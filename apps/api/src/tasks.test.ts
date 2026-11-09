import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { fixedClock } from '@nowwhat/shared'
import { eq } from 'drizzle-orm'
import { buildApp } from './app.ts'
import { createDb, runMigrations, type AppDb } from './db/client.ts'
import { placements } from './db/schema.ts'

let app: FastifyInstance
let db: AppDb
let sqlite: Database.Database

const validInput = {
  title: '数据结构作业',
  description: '完成第三章课后习题',
  priority: 'primary',
  startAt: '2026-11-09T01:00:00Z',
  endAt: '2026-11-10T10:00:00Z'
}

beforeEach(async () => {
  const opened = createDb(':memory:')
  db = opened.db
  sqlite = opened.sqlite
  runMigrations(db)
  app = await buildApp({ clock: fixedClock('2026-11-09T12:00:00Z'), db, sqlite })
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

async function create(payload: Record<string, unknown> = validInput) {
  return app.inject({ method: 'POST', url: '/api/v1/tasks', payload })
}

describe('POST /api/v1/tasks', () => {
  it('创建成功并自动落位到截止时间所在的时间格', async () => {
    const response = await create()

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.task.title).toBe('数据结构作业')
    expect(body.placement).toMatchObject({
      day: '2026-11-10',
      startMinute: 1080,
      endMinute: 1110,
      source: 'auto',
      adjusted: false
    })
  })

  it('名称超宽返回 422 并指明字段', async () => {
    const response = await create({ ...validInput, title: '一'.repeat(16) })

    expect(response.statusCode).toBe(422)
    const body = response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toContainEqual(
      expect.objectContaining({ field: 'title' })
    )
  })

  it('截止早于开始返回 422', async () => {
    const response = await create({
      ...validInput,
      startAt: '2026-11-10T10:00:00Z',
      endAt: '2026-11-09T01:00:00Z'
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error.details).toContainEqual(
      expect.objectContaining({ field: 'endAt' })
    )
  })

  it('截止时间格被占用时向前找空位', async () => {
    await create()
    const second = await create({ ...validInput, title: '组会汇报' })

    expect(second.statusCode).toBe(201)
    expect(second.json().placement).toMatchObject({
      day: '2026-11-10',
      startMinute: 1050,
      endMinute: 1080
    })
  })
})

describe('GET /api/v1/tasks', () => {
  it('返回未完成事务列表', async () => {
    await create()
    const response = await app.inject({ method: 'GET', url: '/api/v1/tasks?status=active' })

    expect(response.statusCode).toBe(200)
    expect(response.json().tasks).toHaveLength(1)
  })
})

describe('GET /api/v1/tasks/:id', () => {
  it('返回事务与它的计划时段', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${created.task.id}`
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.task.id).toBe(created.task.id)
    expect(body.placements).toHaveLength(1)
  })

  it('不存在返回 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks/00000000-0000-4000-8000-000000000000'
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /api/v1/tasks/:id', () => {
  it('修改名称', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${created.task.id}`,
      payload: { title: '数据结构作业（改）' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().task.title).toBe('数据结构作业（改）')
  })

  it('修改截止时间时自动落位卡片跟随', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${created.task.id}`,
      payload: { endAt: '2026-11-11T10:00:00Z' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().placement).toMatchObject({
      day: '2026-11-11',
      startMinute: 1080
    })
  })

  it('校验失败返回 422', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${created.task.id}`,
      payload: { title: '' }
    })

    expect(response.statusCode).toBe(422)
  })
})

describe('DELETE /api/v1/tasks/:id', () => {
  it('删除事务并级联删除计划时段', async () => {
    const created = (await create()).json()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${created.task.id}`
    })
    expect(response.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${created.task.id}`
    })
    expect(after.statusCode).toBe(404)

    const remaining = db.select().from(placements).where(eq(placements.taskId, created.task.id)).all()
    expect(remaining).toHaveLength(0)
  })
})

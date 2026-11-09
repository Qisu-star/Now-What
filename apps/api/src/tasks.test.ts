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
      endMinute: 1140,
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
      startMinute: 1020,
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
describe('归档', () => {
  it('归档后记录完成时间与归档时间', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${created.task.id}/archive`,
      payload: {}
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.task.status).toBe('archived')
    expect(body.task.completedAt).toBe('2026-11-09T12:00:00Z')
    expect(body.task.archivedAt).toBe('2026-11-09T12:00:00Z')
  })

  it('可以指定完成时间和备注', async () => {
    const created = (await create()).json()
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${created.task.id}/archive`,
      payload: { completedAt: '2026-11-08T10:00:00Z', note: '提前完成' }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.task.completedAt).toBe('2026-11-08T10:00:00Z')
    expect(body.task.note).toBe('提前完成')
  })

  it('归档后从待办移到历史', async () => {
    const created = (await create()).json()
    await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${created.task.id}/archive`,
      payload: {}
    })

    const active = await app.inject({ method: 'GET', url: '/api/v1/tasks?status=active' })
    expect(active.json().tasks).toHaveLength(0)

    const archived = await app.inject({ method: 'GET', url: '/api/v1/tasks?status=archived' })
    expect(archived.json().tasks).toHaveLength(1)
    expect(archived.json().tasks[0].id).toBe(created.task.id)
  })

  it('重复归档返回 409', async () => {
    const created = (await create()).json()
    await app.inject({ method: 'POST', url: `/api/v1/tasks/${created.task.id}/archive`, payload: {} })
    const again = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${created.task.id}/archive`,
      payload: {}
    })

    expect(again.statusCode).toBe(409)
  })

  it('归档不存在的事务返回 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks/00000000-0000-4000-8000-000000000000/archive',
      payload: {}
    })
    expect(response.statusCode).toBe(404)
  })

  it('取消归档后回到待办并保留归档信息', async () => {
    const created = (await create()).json()
    await app.inject({ method: 'POST', url: `/api/v1/tasks/${created.task.id}/archive`, payload: {} })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${created.task.id}/unarchive`
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.task.status).toBe('active')
    expect(body.task.completedAt).toBe('2026-11-09T12:00:00Z')

    const active = await app.inject({ method: 'GET', url: '/api/v1/tasks?status=active' })
    expect(active.json().tasks).toHaveLength(1)
  })

  it('已归档事务不能修改名称', async () => {
    const created = (await create()).json()
    await app.inject({ method: 'POST', url: `/api/v1/tasks/${created.task.id}/archive`, payload: {} })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${created.task.id}`,
      payload: { title: '改个名字' }
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error.details).toContainEqual(
      expect.objectContaining({ field: 'title' })
    )
  })

  it('已归档事务可以修改完成时间与备注', async () => {
    const created = (await create()).json()
    await app.inject({ method: 'POST', url: `/api/v1/tasks/${created.task.id}/archive`, payload: {} })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${created.task.id}`,
      payload: { completedAt: '2026-11-07T08:00:00Z', note: '补记' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().task.completedAt).toBe('2026-11-07T08:00:00Z')
    expect(response.json().task.note).toBe('补记')
  })
})
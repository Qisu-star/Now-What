import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { fixedClock } from '@nowwhat/shared'
import { buildApp } from './app.ts'
import { createDb, runMigrations, type AppDb } from './db/client.ts'

let app: FastifyInstance
let db: AppDb
let sqlite: Database.Database

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

async function createTask(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    payload: {
      title: '排期用任务',
      description: '测试',
      priority: 'normal',
      startAt: '2026-11-09T01:00:00Z',
      endAt: '2026-11-12T10:00:00Z'
    }
  })
  return response.json().task.id
}

async function createPlacement(taskId: string, day: string, start: number, end: number) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/placements',
    payload: { taskId, day, startMinute: start, endMinute: end }
  })
}

describe('POST /api/v1/placements', () => {
  it('创建手动排期', async () => {
    const taskId = await createTask()
    const response = await createPlacement(taskId, '2026-11-10', 840, 900)

    expect(response.statusCode).toBe(201)
    expect(response.json().placement).toMatchObject({
      taskId,
      day: '2026-11-10',
      startMinute: 840,
      endMinute: 900,
      source: 'manual',
      adjusted: true
    })
  })

  it('与已有安排重叠返回 409', async () => {
    const taskId = await createTask()
    await createPlacement(taskId, '2026-11-10', 840, 900)
    const response = await createPlacement(taskId, '2026-11-10', 870, 930)

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('CONFLICT')
  })

  it('首尾相接允许', async () => {
    const taskId = await createTask()
    await createPlacement(taskId, '2026-11-10', 840, 900)
    const response = await createPlacement(taskId, '2026-11-10', 900, 960)

    expect(response.statusCode).toBe(201)
  })

  it('任务不存在返回 404', async () => {
    const response = await createPlacement('00000000-0000-4000-8000-000000000000', '2026-11-10', 840, 900)

    expect(response.statusCode).toBe(404)
  })

  it('结束不晚于开始返回 422', async () => {
    const taskId = await createTask()
    const response = await createPlacement(taskId, '2026-11-10', 900, 900)

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/v1/placements', () => {
  it('按日期范围返回', async () => {
    const taskId = await createTask()
    await createPlacement(taskId, '2026-11-10', 840, 900)
    await createPlacement(taskId, '2026-11-13', 840, 900)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/placements?from=2026-11-10&to=2026-11-10'
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().placements).toHaveLength(1)
  })
})

describe('PATCH /api/v1/placements/:id', () => {
  it('移动时段', async () => {
    const taskId = await createTask()
    const created = (await createPlacement(taskId, '2026-11-10', 840, 900)).json()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/placements/${created.placement.id}`,
      payload: { startMinute: 960, endMinute: 1020 }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().placement).toMatchObject({ startMinute: 960, endMinute: 1020 })
  })

  it('移动到冲突位置返回 409 且原位置不变', async () => {
    const taskId = await createTask()
    await createPlacement(taskId, '2026-11-10', 840, 900)
    const second = (await createPlacement(taskId, '2026-11-10', 960, 1020)).json()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/placements/${second.placement.id}`,
      payload: { startMinute: 870, endMinute: 930 }
    })
    expect(response.statusCode).toBe(409)

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/placements?from=2026-11-10&to=2026-11-10'
    })
    const target = list
      .json()
      .placements.find((p: { id: string }) => p.id === second.placement.id)
    expect(target).toMatchObject({ startMinute: 960, endMinute: 1020 })
  })
})

describe('DELETE /api/v1/placements/:id', () => {
  it('删除后不再返回', async () => {
    const taskId = await createTask()
    const created = (await createPlacement(taskId, '2026-11-10', 840, 900)).json()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/placements/${created.placement.id}`
    })
    expect(response.statusCode).toBe(204)

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/placements?from=2026-11-10&to=2026-11-10'
    })
    expect(list.json().placements).toHaveLength(0)
  })
})

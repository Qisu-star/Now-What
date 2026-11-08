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
  app = await buildApp({ clock: fixedClock('2026-11-09T21:00:00Z'), db, sqlite })
})

afterEach(async () => {
  await app.close()
  sqlite.close()
})

describe('GET /api/v1/health', () => {
  it('返回 ok，并使用注入的时钟', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      db: 'ok',
      time: '2026-11-09T21:00:00Z'
    })
  })
})

describe('未知路由', () => {
  it('返回 404 而不是 500', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' })

    expect(response.statusCode).toBe(404)
  })
})

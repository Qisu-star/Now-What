import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { fixedClock } from '@nowwhat/shared'
import { buildApp } from './app.ts'
import { createDb, runMigrations, type AppDb } from './db/client.ts'

let app: FastifyInstance
let db: AppDb
let sqlite: Database.Database
let uploadDir: string

beforeEach(async () => {
  const opened = createDb(':memory:')
  db = opened.db
  sqlite = opened.sqlite
  runMigrations(db)
  uploadDir = mkdtempSync(path.join(os.tmpdir(), 'nowwhat-test-uploads-'))
  app = await buildApp({
    clock: fixedClock('2026-11-09T12:00:00Z'),
    db,
    sqlite,
    uploadDir
  })
})

afterEach(async () => {
  await app.close()
  sqlite.close()
  rmSync(uploadDir, { recursive: true, force: true })
})

async function createTask(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/tasks',
    payload: {
      title: '附件事务',
      description: '测试',
      priority: 'normal',
      startAt: '2026-11-09T01:00:00Z',
      endAt: '2026-11-10T10:00:00Z'
    }
  })
  return response.json().task.id
}

interface UploadOptions {
  taskId: string
  filename: string
  mimeType: string
  kind?: 'task' | 'archive'
  data: Buffer
}

function multipartBody(options: UploadOptions): { body: Buffer; contentType: string } {
  const boundary = '----nowwhattest'
  const kindPart = options.kind
    ? `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${options.kind}\r\n`
    : ''
  const parts: Buffer[] = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="taskId"\r\n\r\n${options.taskId}\r\n${kindPart}`
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${options.filename}"\r\nContent-Type: ${options.mimeType}\r\n\r\n`
    ),
    options.data,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

async function upload(options: UploadOptions) {
  const { body, contentType } = multipartBody(options)
  return app.inject({
    method: 'POST',
    url: '/api/v1/attachments',
    payload: body,
    headers: { 'content-type': contentType }
  })
}

describe('POST /api/v1/attachments', () => {
  it('上传 PDF 后可在列表中看到并落盘', async () => {
    const taskId = await createTask()
    const data = Buffer.from('%PDF-1.4 test')

    const response = await upload({
      taskId,
      filename: '通知.pdf',
      mimeType: 'application/pdf',
      data
    })

    expect(response.statusCode).toBe(201)
    const attachment = response.json().attachment
    expect(attachment).toMatchObject({
      taskId,
      filename: '通知.pdf',
      mimeType: 'application/pdf',
      size: data.length
    })

    const list = await app.inject({ method: 'GET', url: `/api/v1/attachments?taskId=${taskId}` })
    expect(list.json().attachments).toHaveLength(1)

    const stored = path.join(uploadDir, taskId, `${attachment.id}.pdf`)
    expect(existsSync(stored)).toBe(true)
    expect(readFileSync(stored).equals(data)).toBe(true)
  })

  it('超过 20 MB 返回 413', async () => {
    const taskId = await createTask()
    const response = await upload({
      taskId,
      filename: '大文件.pdf',
      mimeType: 'application/pdf',
      data: Buffer.alloc(25 * 1024 * 1024)
    })

    expect(response.statusCode).toBe(413)
  })

  it('不支持的格式返回 415', async () => {
    const taskId = await createTask()
    const response = await upload({
      taskId,
      filename: 'tool.exe',
      mimeType: 'application/octet-stream',
      data: Buffer.from('MZ')
    })

    expect(response.statusCode).toBe(415)
  })

  it('事务不存在返回 404', async () => {
    const response = await upload({
      taskId: '00000000-0000-4000-8000-000000000000',
      filename: 'a.png',
      mimeType: 'image/png',
      data: Buffer.from('png')
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('GET /api/v1/attachments/:id/content', () => {
  it('下载内容与上传一致', async () => {
    const taskId = await createTask()
    const data = Buffer.from('hello attachment')
    const created = (
      await upload({ taskId, filename: 'readme.md', mimeType: 'text/markdown', data })
    ).json().attachment

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/attachments/${created.id}/content`
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('hello attachment')
  })
})

describe('DELETE /api/v1/attachments/:id', () => {
  it('删除附件并移除文件', async () => {
    const taskId = await createTask()
    const created = (
      await upload({
        taskId,
        filename: 'a.png',
        mimeType: 'image/png',
        data: Buffer.from('png')
      })
    ).json().attachment

    const file = path.join(uploadDir, taskId, `${created.id}.png`)
    expect(existsSync(file)).toBe(true)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/attachments/${created.id}`
    })
    expect(response.statusCode).toBe(204)
    expect(existsSync(file)).toBe(false)

    const list = await app.inject({ method: 'GET', url: `/api/v1/attachments?taskId=${taskId}` })
    expect(list.json().attachments).toHaveLength(0)
  })
})

describe('级联删除', () => {
  it('删除事务时清掉附件文件', async () => {
    const taskId = await createTask()
    const created = (
      await upload({
        taskId,
        filename: 'a.png',
        mimeType: 'image/png',
        data: Buffer.from('png')
      })
    ).json().attachment

    const file = path.join(uploadDir, taskId, `${created.id}.png`)
    expect(existsSync(file)).toBe(true)

    await app.inject({ method: 'DELETE', url: `/api/v1/tasks/${taskId}` })

    expect(existsSync(file)).toBe(false)
    const list = await app.inject({ method: 'GET', url: `/api/v1/attachments?taskId=${taskId}` })
    expect(list.json().attachments).toHaveLength(0)
  })
})
describe('附件分类与编码', () => {
  it('默认是事务附件，可指定完成附件', async () => {
    const taskId = await createTask()

    const normal = (
      await upload({
        taskId,
        filename: 'a.md',
        mimeType: 'text/markdown',
        data: Buffer.from('# 事务'),
      })
    ).json().attachment
    expect(normal.kind).toBe('task')

    const archive = (
      await upload({
        taskId,
        filename: 'b.md',
        mimeType: 'text/markdown',
        kind: 'archive',
        data: Buffer.from('# 完成'),
      })
    ).json().attachment
    expect(archive.kind).toBe('archive')
  })

  it('.md 下载时带 utf-8 字符集，避免中文乱码', async () => {
    const taskId = await createTask()
    const created = (
      await upload({
        taskId,
        filename: '说明.md',
        mimeType: 'text/markdown',
        data: Buffer.from('# 中文内容'),
      })
    ).json().attachment

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/attachments/${created.id}/content`,
    })

    expect(response.headers['content-type']).toContain('charset=utf-8')
    expect(response.body).toBe('# 中文内容')
  })
})
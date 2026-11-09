// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTask, deleteTask } from './api.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(status = 200, body: unknown = {}) {
  const mock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('api request headers', () => {
  it('带请求体的写操作声明 content-type', async () => {
    const mock = stubFetch(201, { task: {}, placement: null })
    await createTask({
      title: 't',
      description: 'd',
      priority: 'normal',
      startAt: '2026-11-09T01:00:00Z',
      endAt: '2026-11-09T02:00:00Z'
    })

    const init = mock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe('application/json')
  })

  it('DELETE 没有请求体时不带 content-type', async () => {
    const mock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', mock)

    await deleteTask('t1')

    const init = mock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBeNull()
    expect(init.body).toBeUndefined()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTask, deleteTask } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>

function stubFetch(status: number, body: unknown = {}): FetchMock {
  const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status })
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

function headersOf(call: [RequestInfo | URL, RequestInit?]): Headers {
  return new Headers(call[1]?.headers)
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

    const call = mock.mock.calls[0]
    expect(call).toBeTruthy()
    expect(headersOf(call!).get('content-type')).toBe('application/json')
  })

  it('DELETE 没有请求体时不带 content-type', async () => {
    const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 })
    )
    vi.stubGlobal('fetch', mock)

    await deleteTask('t1')

    const call = mock.mock.calls[0]
    expect(call).toBeTruthy()
    expect(headersOf(call!).get('content-type')).toBeNull()
    expect(call![1]?.body).toBeUndefined()
  })
})

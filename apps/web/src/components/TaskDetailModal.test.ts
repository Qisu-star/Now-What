// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TaskDetailModal from './TaskDetailModal.vue'

const task = {
  id: 't1',
  title: '测试事务',
  description: '描述',
  priority: 'normal' as const,
  startAt: '2026-11-09T01:00:00Z',
  endAt: '2026-11-10T10:00:00Z',
  color: 0,
  status: 'active' as const,
  completedAt: null,
  archivedAt: null,
  note: '',
  createdAt: '2026-11-09T00:00:00Z',
  updatedAt: '2026-11-09T00:00:00Z'
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return new Response(JSON.stringify({ task, placements: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
  )
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TaskDetailModal', () => {
  it('确认后发起 DELETE 并派发 deleted', async () => {
    const wrapper = mount(TaskDetailModal, { props: { taskId: 't1' } })
    await flushPromises()

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '删除')
    expect(deleteButton).toBeTruthy()

    await deleteButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toHaveLength(1)

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const deleteCall = calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE')
    expect(deleteCall?.[0]).toBe('/api/v1/tasks/t1')
  })

  it('用户取消确认时不发请求', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(TaskDetailModal, { props: { taskId: 't1' } })
    await flushPromises()

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '删除')
    await deleteButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toBeUndefined()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
  })
})

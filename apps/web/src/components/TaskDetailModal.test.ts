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
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      if (String(input).includes('/attachments')) {
        return new Response(JSON.stringify({ attachments: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ task, placements: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openDeleteDialog(wrapper: ReturnType<typeof mount>) {
  const deleteButton = wrapper
    .findAll('button')
    .find((button) => button.text().trim() === '删除')
  expect(deleteButton).toBeTruthy()
  await deleteButton!.trigger('click')
  await flushPromises()
  return wrapper.find('[role="dialog"]')
}

describe('TaskDetailModal 删除', () => {
  it('先弹确认框，确认后才发起 DELETE', async () => {
    const wrapper = mount(TaskDetailModal, { props: { taskId: 't1' } })
    await flushPromises()

    const dialog = await openDeleteDialog(wrapper)
    expect(dialog.exists()).toBe(true)

    const callsBefore = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(callsBefore.some((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false
    )

    const confirmButton = dialog.findAll('button').find((button) => button.text().trim() === '删除')
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toHaveLength(1)
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const deleteCall = calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE')
    expect(deleteCall?.[0]).toBe('/api/v1/tasks/t1')
  })

  it('取消时不发请求', async () => {
    const wrapper = mount(TaskDetailModal, { props: { taskId: 't1' } })
    await flushPromises()

    const dialog = await openDeleteDialog(wrapper)
    const cancelButton = dialog.findAll('button').find((button) => button.text().trim() === '取消')
    await cancelButton!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('deleted')).toBeUndefined()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some((call) => (call[1] as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false
    )
  })
})

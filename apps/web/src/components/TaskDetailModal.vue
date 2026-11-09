<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TaskDetail } from '../api'
import { deletePlacement, deleteTask, fetchTask, ApiError } from '../api'
import { PRIORITY_META } from '../theme'
import { fmtDateTime, fmtPlacement, isOverdue } from '../format'
import { toast } from '../toast'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{
  close: []
  edit: [task: TaskDetail['task']]
  deleted: []
  changed: []
}>()

const detail = ref<TaskDetail | null>(null)
const loading = ref(true)
const error = ref('')
const deleting = ref(false)
const confirmingDelete = ref(false)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    detail.value = await fetchTask(props.taskId)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function askDelete(): void {
  if (!detail.value) return
  confirmingDelete.value = true
}

async function removePlacement(id: string): Promise<void> {
  try {
    await deletePlacement(id)
    if (detail.value) {
      detail.value.placements = detail.value.placements.filter((item) => item.id !== id)
    }
    emit('changed')
    toast('已从日程移除')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '移除失败'
  }
}

async function confirmDelete(): Promise<void> {
  confirmingDelete.value = false
  deleting.value = true
  try {
    await deleteTask(props.taskId)
    emit('deleted')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
  } finally {
    deleting.value = false
  }
}

onMounted(load)

const labelClass = 'mb-1 text-xs text-slate-500'
const valueClass = 'text-sm leading-relaxed text-slate-800'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" @click.self="emit('close')">
    <div class="flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 class="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
          {{ detail?.task.title ?? '事务详情' }}
        </h2>
        <button class="text-slate-400 hover:text-slate-600" @click="emit('close')">✕</button>
      </header>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <p v-if="loading" class="text-sm text-slate-500">加载中…</p>
        <p v-else-if="error" class="text-sm text-rose-600">{{ error }}</p>

        <template v-else-if="detail">
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <span
              class="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
              :class="PRIORITY_META[detail.task.priority].chip"
            >
              {{ PRIORITY_META[detail.task.priority].label }}
            </span>
            <span
              v-if="isOverdue(detail.task.endAt)"
              class="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100"
            >
              已逾期
            </span>
          </div>

          <div class="mb-4">
            <p :class="labelClass">事务周期</p>
            <p :class="valueClass">
              {{ fmtDateTime(detail.task.startAt) }} → {{ fmtDateTime(detail.task.endAt) }}
            </p>
          </div>

          <div class="mb-4">
            <p :class="labelClass">描述</p>
            <p :class="valueClass" style="white-space: pre-wrap">{{ detail.task.description }}</p>
          </div>

          <div class="mb-4 border-t border-slate-100 pt-3">
            <p :class="labelClass">计划时段</p>
            <p v-if="detail.placements.length === 0" class="text-sm text-slate-500">
              尚未安排，稍后可在日程表中拖入。
            </p>
            <ul v-else class="flex flex-col gap-1.5">
              <li
                v-for="placement in detail.placements"
                :key="placement.id"
                class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                <span>{{ fmtPlacement(placement.day, placement.startMinute, placement.endMinute) }}</span>
                <span class="flex items-center gap-3">
                  <span class="text-xs text-slate-400">{{ placement.adjusted ? '手动' : '自动' }}</span>
                  <button
                    type="button"
                    class="text-xs text-slate-400 transition hover:text-rose-600"
                    :data-testid="`remove-placement-${placement.id}`"
                    @click="removePlacement(placement.id)"
                  >
                    移除
                  </button>
                </span>
              </li>
            </ul>
          </div>

          <div class="border-t border-slate-100 pt-3">
            <p :class="labelClass">附件</p>
            <p class="text-xs text-slate-500">附件功能在 M5 实现，本期先保留位置。</p>
          </div>
        </template>
      </div>

      <footer class="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
        <button
          class="mr-auto rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 hover:bg-rose-100 disabled:opacity-60"
          :disabled="!detail || deleting"
          data-testid="delete-task"
          @click="askDelete"
        >
          {{ deleting ? '删除中…' : '删除' }}
        </button>
        <button class="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" @click="emit('close')">
          关闭
        </button>
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          :disabled="!detail"
          data-testid="edit-task"
          @click="detail && emit('edit', detail.task)"
        >
          修改
        </button>
      </footer>
    </div>

    <ConfirmDialog
      v-if="confirmingDelete"
      tone="danger"
      title="删除事务"
      :description="`「${detail?.task.title ?? ''}」及其全部日程安排都会被删除，且无法恢复。`"
      confirm-text="删除"
      @confirm="confirmDelete"
      @cancel="confirmingDelete = false"
    />
  </div>
</template>

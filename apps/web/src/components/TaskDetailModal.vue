<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TaskDetail } from '../api'
import type { Placement } from '@nowwhat/shared'
import { createPlacement, deletePlacement, deleteTask, fetchTask, updatePlacement, ApiError } from '../api'
import { PRIORITY_META } from '../theme'
import { fmtDateTime, fmtPlacement, isOverdue, localParts, minutesToTime, timeToMinutes } from '../format'
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
const manualDay = ref('')
const manualStart = ref('09:00')
const manualEnd = ref('10:00')
const addingManual = ref(false)
const editingId = ref<string | null>(null)
const editDay = ref('')
const editStart = ref('09:00')
const editEnd = ref('10:00')
const savingEdit = ref(false)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    detail.value = await fetchTask(props.taskId)
    manualDay.value = localParts(detail.value.task.endAt).date
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

function startEdit(placement: Placement): void {
  editingId.value = placement.id
  editDay.value = placement.day
  editStart.value = minutesToTime(placement.startMinute)
  editEnd.value = minutesToTime(placement.endMinute)
  error.value = ''
}

async function saveEdit(): Promise<void> {
  if (!editingId.value) return

  const startMinute = timeToMinutes(editStart.value)
  const endMinute = timeToMinutes(editEnd.value)

  if (endMinute <= startMinute) {
    error.value = '结束时间必须晚于开始时间'
    return
  }

  savingEdit.value = true
  try {
    const { placement } = await updatePlacement(editingId.value, {
      day: editDay.value,
      startMinute,
      endMinute
    })
    const current = detail.value
    if (current) {
      current.placements = current.placements
        .map((item) => (item.id === placement.id ? placement : item))
        .sort((a, b) => (a.day === b.day ? a.startMinute - b.startMinute : a.day.localeCompare(b.day)))
    }
    editingId.value = null
    error.value = ''
    emit('changed')
    toast('已更新时段')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      error.value = '该时段已被占用'
    } else {
      error.value = err instanceof Error ? err.message : '更新失败'
    }
  } finally {
    savingEdit.value = false
  }
}

async function addManualPlacement(): Promise<void> {
  if (!detail.value) return

  const startMinute = timeToMinutes(manualStart.value)
  const endMinute = timeToMinutes(manualEnd.value)

  if (!manualDay.value) {
    error.value = '请选择日期'
    return
  }
  if (endMinute <= startMinute) {
    error.value = '结束时间必须晚于开始时间'
    return
  }

  addingManual.value = true
  try {
    const { placement } = await createPlacement({
      taskId: props.taskId,
      day: manualDay.value,
      startMinute,
      endMinute
    })
    const current = detail.value
    if (current) {
      current.placements = [...current.placements, placement].sort((a, b) =>
        a.day === b.day ? a.startMinute - b.startMinute : a.day.localeCompare(b.day)
      )
    }
    error.value = ''
    emit('changed')
    toast('已添加时段')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      error.value = '该时段已被占用'
    } else {
      error.value = err instanceof Error ? err.message : '添加失败'
    }
  } finally {
    addingManual.value = false
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
        <p v-else-if="!detail && error" class="text-sm text-rose-600">{{ error }}</p>

        <template v-else-if="detail">
          <p
            v-if="error"
            class="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600"
          >
            {{ error }}
          </p>
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
                class="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                <div
                  v-if="editingId === placement.id"
                  class="flex flex-wrap items-center gap-1.5"
                >
                  <input
                    v-model="editDay"
                    type="date"
                    data-testid="edit-day"
                    class="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <input
                    v-model="editStart"
                    type="time"
                    step="300"
                    data-testid="edit-start"
                    class="w-[84px] rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <span class="text-xs text-slate-400">–</span>
                  <input
                    v-model="editEnd"
                    type="time"
                    step="300"
                    data-testid="edit-end"
                    class="w-[84px] rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <span class="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-slate-400 hover:text-slate-700"
                      @click="editingId = null"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-testid="save-placement"
                      class="rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                      :disabled="savingEdit"
                      @click="saveEdit"
                    >
                      {{ savingEdit ? '保存中…' : '保存' }}
                    </button>
                  </span>
                </div>

                <div v-else class="flex items-center justify-between">
                  <span>{{ fmtPlacement(placement.day, placement.startMinute, placement.endMinute) }}</span>
                  <span class="flex items-center gap-3">
                    <span class="text-xs text-slate-400">{{ placement.adjusted ? '手动' : '自动' }}</span>
                    <button
                      type="button"
                      class="text-xs text-slate-400 transition hover:text-blue-600"
                      :data-testid="`edit-placement-${placement.id}`"
                      @click="startEdit(placement)"
                    >
                      修改
                    </button>
                    <button
                      type="button"
                      class="text-xs text-slate-400 transition hover:text-rose-600"
                      :data-testid="`remove-placement-${placement.id}`"
                      @click="removePlacement(placement.id)"
                    >
                      移除
                    </button>
                  </span>
                </div>
              </li>
            </ul>

            <div class="mt-3 rounded-lg bg-slate-50 p-2">
              <p class="mb-1.5 text-[11px] text-slate-500">手动添加时段</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <input
                  v-model="manualDay"
                  type="date"
                  data-testid="manual-day"
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                />
                <input
                  v-model="manualStart"
                  type="time"
                  step="300"
                  data-testid="manual-start"
                  class="w-[84px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                />
                <span class="text-xs text-slate-400">–</span>
                <input
                  v-model="manualEnd"
                  type="time"
                  step="300"
                  data-testid="manual-end"
                  class="w-[84px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  data-testid="add-placement"
                  class="ml-auto rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  :disabled="addingManual"
                  @click="addManualPlacement"
                >
                  {{ addingManual ? '添加中…' : '添加' }}
                </button>
              </div>
            </div>
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

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { fromLocalDayMinutes, type Attachment, type Placement } from '@nowwhat/shared'
import type { TaskDetail } from '../api'
import {
  archiveTask,
  attachmentUrl,
  createPlacement,
  deleteAttachment,
  deletePlacement,
  deleteTask,
  fetchAttachments,
  fetchTask,
  unarchiveTask,
  uploadAttachment,
  updateArchiveInfo,
  updatePlacement,
  ApiError
} from '../api'
import { PRIORITY_META } from '../theme'
import {
  fmtDateTime,
  fmtPlacement,
  isOverdue,
  localParts,
  minutesToTime,
  timeToMinutes
} from '../format'
import { toast } from '../toast'
import ConfirmDialog from './ConfirmDialog.vue'
import ArchiveDialog from './ArchiveDialog.vue'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{
  close: []
  edit: [task: TaskDetail['task']]
  deleted: []
  changed: []
  archived: [released: number]
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

const attachments = ref<Attachment[]>([])
const uploading = ref(false)
const attachmentError = ref('')
const pendingDeleteAttachment = ref<string | null>(null)

const archiveForm = reactive({ date: '', time: '09:00', note: '' })
const savingArchive = ref(false)
const showArchiveDialog = ref(false)

const archived = computed(() => detail.value?.task.status === 'archived')

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    detail.value = await fetchTask(props.taskId)
    attachments.value = await fetchAttachments(props.taskId)
    manualDay.value = localParts(detail.value.task.endAt).date

    if (detail.value.task.status === 'archived') {
      const completed = detail.value.task.completedAt ?? detail.value.task.archivedAt
      if (completed) {
        const parts = localParts(completed)
        archiveForm.date = parts.date
        archiveForm.time = parts.time
      }
      archiveForm.note = detail.value.task.note
    }
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

async function confirmArchive(payload: { completedAt?: string; note: string }): Promise<void> {
  showArchiveDialog.value = false
  try {
    const { released } = await archiveTask(props.taskId, payload)
    emit('archived', released)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '归档失败'
  }
}

async function saveArchiveInfo(): Promise<void> {
  if (!detail.value) return
  const minutes = timeToMinutes(archiveForm.time)
  const completedAt = fromLocalDayMinutes(archiveForm.date, minutes)

  savingArchive.value = true
  try {
    const { task } = await updateArchiveInfo(props.taskId, {
      completedAt,
      note: archiveForm.note.trim()
    })
    detail.value.task = task
    error.value = ''
    emit('changed')
    toast('归档信息已保存')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    savingArchive.value = false
  }
}

function isImage(item: Attachment): boolean {
  return item.mimeType.startsWith('image/') || /\.(png|jpe?g)$/i.test(item.filename)
}

function formatSize(size: number): string {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  attachmentError.value = ''
  uploading.value = true
  try {
    const attachment = await uploadAttachment(props.taskId, file)
    attachments.value = [...attachments.value, attachment]
    toast('附件已上传')
  } catch (err) {
    attachmentError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeAttachment(id: string): Promise<void> {
  attachmentError.value = ''
  try {
    await deleteAttachment(id)
    attachments.value = attachments.value.filter((item) => item.id !== id)
    pendingDeleteAttachment.value = null
    toast('附件已删除')
  } catch (err) {
    attachmentError.value = err instanceof Error ? err.message : '删除失败'
  }
}

async function unarchive(): Promise<void> {
  try {
    await unarchiveTask(props.taskId)
    emit('changed')
    emit('close')
    toast('已恢复到待办')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消归档失败'
  }
}

onMounted(load)

const labelClass = 'mb-1 text-xs text-slate-500'
const valueClass = 'text-sm leading-relaxed text-slate-800'
const inputClass =
  'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" @click.self="emit('close')">
    <div class="flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <h2
            class="min-w-0 truncate text-base font-semibold text-slate-900"
            :class="archived ? 'line-through decoration-slate-400' : ''"
          >
            {{ detail?.task.title ?? '事务详情' }}
          </h2>
          <span
            v-if="archived"
            class="flex-none rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
          >
            已归档
          </span>
        </div>
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
              v-if="!archived && isOverdue(detail.task.endAt)"
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
                <div v-if="editingId === placement.id" class="flex flex-wrap items-center gap-1.5">
                  <input v-model="editDay" type="date" data-testid="edit-day" :class="inputClass" />
                  <input
                    v-model="editStart"
                    type="time"
                    step="300"
                    data-testid="edit-start"
                    :class="inputClass"
                  />
                  <span class="text-xs text-slate-400">–</span>
                  <input
                    v-model="editEnd"
                    type="time"
                    step="300"
                    data-testid="edit-end"
                    :class="inputClass"
                  />
                  <span class="ml-auto flex items-center gap-2">
                    <button type="button" class="text-xs text-slate-400 hover:text-slate-700" @click="editingId = null">
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
                    <template v-if="!archived">
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
                    </template>
                  </span>
                </div>
              </li>
            </ul>

            <div v-if="!archived" class="mt-3 rounded-lg bg-slate-50 p-2">
              <p class="mb-1.5 text-[11px] text-slate-500">手动添加时段</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <input v-model="manualDay" type="date" data-testid="manual-day" :class="inputClass" />
                <input
                  v-model="manualStart"
                  type="time"
                  step="300"
                  data-testid="manual-start"
                  :class="inputClass"
                />
                <span class="text-xs text-slate-400">–</span>
                <input
                  v-model="manualEnd"
                  type="time"
                  step="300"
                  data-testid="manual-end"
                  :class="inputClass"
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

          <div v-if="archived" class="mb-4 border-t border-slate-100 pt-3">
            <p :class="labelClass">归档信息</p>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-1.5">
                <span class="w-14 text-xs text-slate-500">完成时间</span>
                <input
                  v-model="archiveForm.date"
                  type="date"
                  data-testid="archive-info-date"
                  :class="inputClass"
                />
                <input
                  v-model="archiveForm.time"
                  type="time"
                  step="300"
                  data-testid="archive-info-time"
                  :class="inputClass"
                />
              </div>
              <div class="flex items-start gap-1.5">
                <span class="w-14 flex-none pt-1 text-xs text-slate-500">备注</span>
                <textarea
                  v-model="archiveForm.note"
                  rows="2"
                  data-testid="archive-info-note"
                  :class="inputClass"
                  class="min-w-0 flex-1 resize-none"
                  placeholder="归档备注"
                />
              </div>
              <div class="flex justify-end">
                <button
                  type="button"
                  data-testid="save-archive-info"
                  class="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                  :disabled="savingArchive"
                  @click="saveArchiveInfo"
                >
                  {{ savingArchive ? '保存中…' : '保存归档信息' }}
                </button>
              </div>
            </div>
            <p v-if="detail.task.archivedAt" class="mt-2 text-[11px] text-slate-400">
              归档于 {{ fmtDateTime(detail.task.archivedAt) }}
            </p>
          </div>

          <div class="border-t border-slate-100 pt-3">
            <div class="mb-1.5 flex items-center justify-between">
              <p class="text-xs text-slate-500">附件</p>
              <label
                class="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                {{ uploading ? '上传中…' : '上传文件' }}
                <input
                  type="file"
                  class="hidden"
                  accept=".md,.docx,.pdf,.jpg,.jpeg,.png"
                  data-testid="attachment-input"
                  @change="onFileChange"
                />
              </label>
            </div>

            <p v-if="attachmentError" class="mb-1 text-xs text-rose-600">{{ attachmentError }}</p>

            <p v-if="attachments.length === 0" class="text-xs text-slate-500">
              支持 .md / .docx / .pdf / .jpg / .png，单个不超过 20 MB。
            </p>

            <ul v-else class="flex flex-col gap-1.5">
              <li
                v-for="item in attachments"
                :key="item.id"
                class="rounded-lg border border-slate-100 px-3 py-2"
              >
                <div class="flex items-center gap-2 text-sm text-slate-700">
                  <span class="min-w-0 flex-1 truncate">{{ item.filename }}</span>
                  <span class="flex-none text-[11px] text-slate-400">{{ formatSize(item.size) }}</span>
                  <a
                    :href="attachmentUrl(item.id)"
                    target="_blank"
                    rel="noreferrer"
                    class="flex-none text-xs text-slate-400 transition hover:text-blue-600"
                    data-testid="attachment-open"
                  >
                    打开
                  </a>
                  <button
                    v-if="pendingDeleteAttachment === item.id"
                    type="button"
                    class="flex-none text-xs font-semibold text-rose-600"
                    data-testid="attachment-delete-confirm"
                    @click="removeAttachment(item.id)"
                  >
                    确认删除
                  </button>
                  <button
                    v-else
                    type="button"
                    class="flex-none text-xs text-slate-400 transition hover:text-rose-600"
                    data-testid="attachment-delete"
                    @click="pendingDeleteAttachment = item.id"
                  >
                    删除
                  </button>
                </div>
                <img
                  v-if="isImage(item)"
                  :src="attachmentUrl(item.id)"
                  :alt="item.filename"
                  class="mt-2 max-h-40 rounded-md border border-slate-100 object-contain"
                  data-testid="attachment-image"
                />
              </li>
            </ul>
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

        <template v-if="archived">
          <button
            data-testid="unarchive-task"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            :disabled="!detail"
            @click="unarchive"
          >
            取消归档
          </button>
        </template>
        <template v-else>
          <button
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            data-testid="edit-task"
            :disabled="!detail"
            @click="detail && emit('edit', detail.task)"
          >
            修改
          </button>
          <button
            data-testid="archive-task"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            :disabled="!detail"
            @click="showArchiveDialog = true"
          >
            完成归档
          </button>
        </template>
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

    <ArchiveDialog
      v-if="showArchiveDialog && detail"
      :title="detail.task.title"
      :placements="detail.placements"
      @confirm="confirmArchive"
      @cancel="showArchiveDialog = false"
    />
  </div>
</template>

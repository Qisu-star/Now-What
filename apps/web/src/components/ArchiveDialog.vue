<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { fromLocalDayMinutes, toLocalDayMinutes, type Placement } from '@nowwhat/shared'
import { timeToMinutes, minutesToTime } from '../format'

const props = defineProps<{ title: string; placements: Placement[] }>()
const emit = defineEmits<{
  confirm: [payload: { completedAt?: string; note: string; files: File[] }]
  cancel: []
}>()

const files = ref<File[]>([])

function onFilesChange(event: Event): void {
  const input = event.target as HTMLInputElement
  files.value = Array.from(input.files ?? [])
}

const now = toLocalDayMinutes(new Date().toISOString())
const form = reactive({
  date: now.day,
  time: minutesToTime(now.minutes),
  note: ''
})

const submitting = ref(false)
const error = ref('')

/** 完成时间之后的安排会在归档时被释放 */
const futureCount = computed(() => {
  const day = form.date
  const minutes = timeToMinutes(form.time)
  return props.placements.filter(
    (placement) => placement.day > day || (placement.day === day && placement.startMinute >= minutes)
  ).length
})

function submit(): void {
  error.value = ''
  const minutes = timeToMinutes(form.time)
  const completedAt = fromLocalDayMinutes(form.date, minutes)

  if (Number.isNaN(Date.parse(completedAt))) {
    error.value = '完成时间无效'
    return
  }

  emit('confirm', {
    completedAt,
    note: form.note.trim(),
    files: files.value
  })
}

const inputClass =
  'rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500'
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
    role="dialog"
    aria-modal="true"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h3 class="text-base font-semibold text-slate-900">完成并归档</h3>
      <p class="mt-1 text-xs text-slate-500">「{{ props.title }}」会移到历史，日程卡片变灰。</p>

      <div class="mt-4 flex flex-col gap-3">
        <div>
          <label class="mb-1 block text-xs text-slate-500">完成时间</label>
          <div class="flex items-center gap-1.5">
            <input v-model="form.date" type="date" data-testid="archive-date" :class="inputClass" />
            <input
              v-model="form.time"
              type="time"
              step="300"
              data-testid="archive-time"
              :class="inputClass"
            />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">归档备注（可选）</label>
          <textarea
            v-model="form.note"
            rows="2"
            data-testid="archive-note"
            :class="inputClass"
            class="w-full resize-none"
            placeholder="例如：提前完成，效果不错"
          />
        </div>

        <p
          v-if="futureCount > 0"
          data-testid="release-hint"
          class="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700"
        >
          该事务还有 {{ futureCount }} 个未来安排，归档后这些时段会被释放，可安排其他事务。
        </p>

        <div>
          <label class="mb-1 block text-xs text-slate-500">完成附件（可选）</label>
          <input
            type="file"
            multiple
            accept=".md,.docx,.pdf,.jpg,.jpeg,.png"
            data-testid="archive-attachments"
            class="block w-full text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:text-slate-700"
            @change="onFilesChange"
          />
          <p v-if="files.length > 0" class="mt-1 text-[11px] text-slate-400">
            已选择 {{ files.length }} 个文件，归档后作为「完成附件」上传。
          </p>
        </div>

        <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          data-testid="confirm-archive"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          @click="submit"
        >
          确认归档
        </button>
      </div>
    </div>
  </div>
</template>

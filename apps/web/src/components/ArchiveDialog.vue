<script setup lang="ts">
import { reactive, ref } from 'vue'
import { fromLocalDayMinutes, toLocalDayMinutes } from '@nowwhat/shared'
import { timeToMinutes, minutesToTime } from '../format'

const props = defineProps<{ title: string }>()
const emit = defineEmits<{
  confirm: [payload: { completedAt?: string; note: string }]
  cancel: []
}>()

const now = toLocalDayMinutes(new Date().toISOString())
const form = reactive({
  date: now.day,
  time: minutesToTime(now.minutes),
  note: ''
})

const submitting = ref(false)
const error = ref('')

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
    note: form.note.trim()
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

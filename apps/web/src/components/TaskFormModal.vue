<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  PRIORITIES,
  fromLocalDayMinutes,
  validateTaskInput,
  type Priority,
  type Task,
  type TaskInput
} from '@nowwhat/shared'
import { ApiError, createTask, updateTask } from '../api'
import { PRIORITY_META } from '../theme'
import { localParts, timeToMinutes, todayLocal } from '../format'

const props = defineProps<{ task?: Task | null }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const form = reactive({
  title: '',
  description: '',
  priority: 'normal' as Priority,
  startDate: todayLocal(),
  startTime: '09:00',
  endDate: todayLocal(),
  endTime: '10:00'
})

if (props.task) {
  const start = localParts(props.task.startAt)
  const end = localParts(props.task.endAt)
  Object.assign(form, {
    title: props.task.title,
    description: props.task.description,
    priority: props.task.priority,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time
  })
}

const errors = ref<Record<string, string>>({})
const generalError = ref('')
const saving = ref(false)

function buildInput(): TaskInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    startAt: fromLocalDayMinutes(form.startDate, timeToMinutes(form.startTime)),
    endAt: fromLocalDayMinutes(form.endDate, timeToMinutes(form.endTime))
  }
}

async function submit(): Promise<void> {
  generalError.value = ''
  errors.value = {}

  const input = buildInput()
  const issues = validateTaskInput(input)
  if (issues.length > 0) {
    errors.value = Object.fromEntries(issues.map((issue) => [issue.field, issue.message]))
    return
  }

  saving.value = true
  try {
    if (props.task) {
      await updateTask(props.task.id, input)
    } else {
      await createTask(input)
    }
    emit('saved')
  } catch (error) {
    if (error instanceof ApiError && error.details.length > 0) {
      errors.value = Object.fromEntries(error.details.map((d) => [d.field, d.message]))
    } else {
      generalError.value = error instanceof Error ? error.message : '保存失败'
    }
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" @click.self="emit('cancel')">
    <form class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" @submit.prevent="submit">
      <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900">{{ task ? '修改事务' : '新建事务' }}</h2>
        <button type="button" class="text-slate-400 hover:text-slate-600" @click="emit('cancel')">✕</button>
      </header>

      <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-4">
        <div>
          <label class="mb-1 block text-xs text-slate-500">名称 *</label>
          <input v-model="form.title" :class="inputClass" placeholder="例如：数据结构作业" />
          <p v-if="errors.title" class="mt-1 text-xs text-rose-600">{{ errors.title }}</p>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">描述 *</label>
          <textarea v-model="form.description" :class="inputClass" rows="3" placeholder="写清楚要做什么" />
          <p v-if="errors.description" class="mt-1 text-xs text-rose-600">{{ errors.description }}</p>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">优先级 *</label>
          <div class="flex gap-1 rounded-lg bg-slate-50 p-1">
            <button
              v-for="priority in PRIORITIES"
              :key="priority"
              type="button"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition"
              :class="form.priority === priority ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="form.priority = priority"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="PRIORITY_META[priority].dot" />
              {{ PRIORITY_META[priority].label }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">事务周期 *</label>
          <div class="flex items-center gap-2">
            <span class="w-8 shrink-0 text-xs text-slate-500">开始</span>
            <input v-model="form.startDate" type="date" :class="inputClass" />
            <input v-model="form.startTime" type="time" step="300" class="w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span class="w-8 shrink-0 text-xs text-slate-500">截止</span>
            <input v-model="form.endDate" type="date" :class="inputClass" />
            <input v-model="form.endTime" type="time" step="300" class="w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <p v-if="errors.startAt || errors.endAt" class="mt-1 text-xs text-rose-600">
            {{ errors.startAt || errors.endAt }}
          </p>
        </div>

        <p v-if="generalError" class="text-xs text-rose-600">{{ generalError }}</p>
      </div>

      <footer class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" @click="emit('cancel')">
          取消
        </button>
        <button
          type="submit"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          :disabled="saving"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </footer>
    </form>
  </div>
</template>

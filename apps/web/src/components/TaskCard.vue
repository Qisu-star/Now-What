<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@nowwhat/shared'
import { PRIORITY_META, taskColor } from '../theme'
import { fmtDateTime, isOverdue } from '../format'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ open: [id: string] }>()

const meta = computed(() => PRIORITY_META[props.task.priority])
const overdue = computed(() => isOverdue(props.task.endAt))
</script>

<template>
  <button
    class="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
    :style="{ borderTop: `3px solid ${taskColor(task.color)}` }"
    @click="emit('open', task.id)"
  >
    <div class="flex items-start gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
        {{ task.title }}
      </span>
      <span
        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
        :class="meta.chip"
      >
        {{ meta.label }}
      </span>
    </div>

    <p class="line-clamp-2 text-xs leading-relaxed text-slate-600">{{ task.description }}</p>

    <p class="text-xs" :class="overdue ? 'font-semibold text-rose-600' : 'text-slate-500'">
      截止 {{ fmtDateTime(task.endAt) }}<template v-if="overdue"> · 已逾期</template>
    </p>
  </button>
</template>

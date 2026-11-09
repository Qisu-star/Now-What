<script setup lang="ts">
import { computed } from 'vue'
import type { Placement, Task } from '@nowwhat/shared'
import { taskColor } from '../theme'
import { dayNumber, minutesToTime, monthGridDays, todayLocal, weekdayIndex } from '../format'

const props = defineProps<{ month: string; tasks: Task[]; placements: Placement[] }>()
const emit = defineEmits<{ 'open-task': [taskId: string]; 'select-day': [day: string] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const today = todayLocal()
const days = computed(() => monthGridDays(props.month))
const currentMonth = computed(() => props.month.slice(0, 7))

const tasksById = computed(() => new Map(props.tasks.map((task) => [task.id, task])))

const byDay = computed(() => {
  const map = new Map<string, { placement: Placement; task: Task }[]>()

  for (const placement of props.placements) {
    const task = tasksById.value.get(placement.taskId)
    if (!task) continue
    const list = map.get(placement.day) ?? []
    list.push({ placement, task })
    map.set(placement.day, list)
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.placement.startMinute - b.placement.startMinute)
  }
  return map
})

function itemsOf(day: string): { placement: Placement; task: Task }[] {
  return byDay.value.get(day) ?? []
}
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col bg-white">
    <div class="grid grid-cols-7 border-b border-slate-200">
      <div
        v-for="(name, index) in WEEKDAYS"
        :key="name"
        class="py-2 text-center text-[11.5px]"
        :class="index >= 5 ? 'text-slate-400' : 'text-slate-500'"
      >
        周{{ name }}
      </div>
    </div>

    <div class="grid flex-1 grid-cols-7 grid-rows-6">
      <div
        v-for="day in days"
        :key="day"
        class="month-cell group flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-r border-slate-100 p-1 transition hover:bg-slate-50"
        :class="[
          day.slice(0, 7) === currentMonth ? '' : 'bg-slate-50/50',
          weekdayIndex(day) >= 5 ? 'bg-slate-50/40' : '',
          day === today ? 'ring-2 ring-inset ring-blue-500' : ''
        ]"
        @click="emit('select-day', day)"
      >
        <span
          class="self-end px-0.5 text-[11px] font-medium"
          :class="
            day === today
              ? 'text-blue-600'
              : day.slice(0, 7) === currentMonth
                ? 'text-slate-600'
                : 'text-slate-400'
          "
        >
          {{ dayNumber(day) }}
        </span>

        <button
          v-for="item in itemsOf(day).slice(0, 2)"
          :key="item.placement.id"
          type="button"
          class="flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left text-[10px] text-slate-700 transition hover:bg-white"
          @click.stop="emit('open-task', item.task.id)"
        >
          <span
            class="h-1.5 w-1.5 flex-none rounded-full"
            :style="{ backgroundColor: taskColor(item.task.color) }"
          />
          <span class="flex-none tabular-nums text-slate-400">
            {{ minutesToTime(item.placement.startMinute) }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ item.task.title }}</span>
        </button>

        <span
          v-if="itemsOf(day).length > 2"
          class="px-0.5 text-[10px] text-slate-400"
        >
          +{{ itemsOf(day).length - 2 }}
        </span>
      </div>
    </div>
  </section>
</template>

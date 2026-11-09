<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Placement, Task } from '@nowwhat/shared'
import { taskColor } from '../theme'
import {
  addDays,
  dayNumber,
  monthDay,
  monthGridDays,
  shortDay,
  minutesToTime,
  todayLocal,
  weekdayIndex,
  weekdayShort,
  weekDays
} from '../format'

const props = defineProps<{ month: string; tasks: Task[]; placements: Placement[] }>()
const emit = defineEmits<{
  'open-task': [taskId: string]
  'enter-view': [kind: 'day' | 'week', day: string]
}>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const GRID_STYLE = {
  gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))'
}

const today = todayLocal()
const days = computed(() => monthGridDays(props.month))
const weeks = computed(() => {
  const result: string[][] = []
  for (let index = 0; index < days.value.length; index += 7) {
    result.push(days.value.slice(index, index + 7))
  }
  return result
})
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

interface Preview {
  kind: 'day' | 'week'
  day: string
  x: number
  y: number
}

const preview = ref<Preview | null>(null)

const previewGroups = computed(() => {
  const current = preview.value
  if (!current) return []
  const dayList = current.kind === 'week' ? weekDays(current.day) : [current.day]
  return dayList.map((day) => ({ day, items: itemsOf(day) }))
})

const previewCount = computed(() =>
  previewGroups.value.reduce((total, group) => total + group.items.length, 0)
)

const previewTitle = computed(() => {
  const current = preview.value
  if (!current) return ''
  if (current.kind === 'day') return `${monthDay(current.day)} ${weekdayShort(current.day)}`
  const monday = weekDays(current.day)[0] ?? current.day
  return `${monthDay(monday)} – ${monthDay(addDays(monday, 6))}`
})

function clamp(value: number, max: number): number {
  return Math.max(8, Math.min(value, max))
}

function showPreview(kind: 'day' | 'week', day: string, event: MouseEvent): void {
  preview.value = {
    kind,
    day,
    x: clamp(event.clientX, window.innerWidth - 300),
    y: clamp(event.clientY, window.innerHeight - 340)
  }
}

function enterView(): void {
  const current = preview.value
  if (!current) return
  const day = current.kind === 'week' ? (weekDays(current.day)[0] ?? current.day) : current.day
  preview.value = null
  emit('enter-view', current.kind, day)
}
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col bg-white">
    <div class="grid border-b border-slate-200" :style="GRID_STYLE">
      <div class="border-r border-slate-100" />
      <div
        v-for="(name, index) in WEEKDAYS"
        :key="name"
        class="py-2 text-center text-[11.5px]"
        :class="index >= 5 ? 'text-slate-400' : 'text-slate-500'"
      >
        周{{ name }}
      </div>
    </div>

    <div
      class="grid flex-1"
      :style="{ ...GRID_STYLE, gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }"
    >
      <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
        <button
          type="button"
          data-testid="week-head"
          class="flex cursor-pointer flex-col items-center justify-center gap-0.5 border-b border-r border-slate-100 bg-slate-50/60 text-[10px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          :title="`预览这一周（${monthDay(week[0]!)} 起）`"
          @click="showPreview('week', week[0]!, $event)"
        >
          <span class="font-medium tabular-nums">{{ shortDay(week[0]!) }}</span>
        </button>

        <div
          v-for="day in week"
          :key="day"
          class="month-cell group flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-r border-slate-100 p-1 transition hover:bg-slate-50"
          :class="[
            day.slice(0, 7) === currentMonth ? '' : 'bg-slate-50/50',
            weekdayIndex(day) >= 5 ? 'bg-slate-50/40' : '',
            day === today ? 'ring-2 ring-inset ring-blue-500' : ''
          ]"
          @click="showPreview('day', day, $event)"
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

          <span v-if="itemsOf(day).length > 2" class="px-0.5 text-[10px] text-slate-400">
            +{{ itemsOf(day).length - 2 }}
          </span>
        </div>
      </template>
    </div>

    <div v-if="preview" class="fixed inset-0 z-40" @click="preview = null">
      <div
        class="absolute w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        :style="{ left: `${preview.x}px`, top: `${preview.y}px` }"
        @click.stop
      >
        <header class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span class="text-xs font-semibold text-slate-900">{{ previewTitle }}</span>
          <button class="text-slate-400 hover:text-slate-600" @click="preview = null">✕</button>
        </header>

        <div class="max-h-[240px] overflow-y-auto p-2">
          <p v-if="previewCount === 0" class="px-1 py-3 text-xs text-slate-500">
            {{ preview.kind === 'week' ? '这一周没有安排' : '当天没有安排' }}
          </p>

          <template v-for="group in previewGroups" :key="group.day">
            <p
              v-if="preview.kind === 'week' && group.items.length > 0"
              class="px-1 py-0.5 text-[10px] text-slate-400"
            >
              {{ monthDay(group.day) }} {{ weekdayShort(group.day) }}
            </p>
            <button
              v-for="item in group.items"
              :key="item.placement.id"
              type="button"
              class="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              @click="emit('open-task', item.task.id); preview = null"
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
          </template>
        </div>

        <footer class="border-t border-slate-100 px-2 py-2 text-right">
          <button
            type="button"
            data-testid="enter-view"
            class="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
            @click="enterView"
          >
            进入{{ preview.kind === 'week' ? '周表' : '日表' }}
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

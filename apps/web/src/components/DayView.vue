<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Placement, Task } from '@nowwhat/shared'
import { applyDrop } from '../placementDrop'
import { dayNumber, todayLocal, weekdayShort } from '../format'
import { configureDrag, drag, HOUR_PX, setDragColumns, type DragPayload } from '../drag'
import EventCard from './EventCard.vue'

const props = defineProps<{ day: string; tasks: Task[]; placements: Placement[] }>()
const emit = defineEmits<{ changed: []; 'open-task': [taskId: string] }>()

const scroller = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
const today = todayLocal()

interface DayEvent {
  placement: Placement
  task: Task
}

const tasksById = computed(() => new Map(props.tasks.map((task) => [task.id, task])))

function eventsOf(day: string): DayEvent[] {
  const result: DayEvent[] = []
  const list = props.placements
    .filter((placement) => placement.day === day)
    .slice()
    .sort((a, b) => a.startMinute - b.startMinute)

  for (const placement of list) {
    const task = tasksById.value.get(placement.taskId)
    if (task) result.push({ placement, task })
  }
  return result
}

function registerColumns(): void {
  const element = body.value?.querySelector<HTMLElement>('.cal-col')
  setDragColumns(element ? [{ day: props.day, el: element }] : [])
}

function scrollToMorning(): void {
  if (scroller.value) scroller.value.scrollTop = 8 * HOUR_PX - 8
}

function handleDrop(payload: DragPayload): void {
  void applyDrop(payload, () => emit('changed'))
}

onMounted(async () => {
  configureDrag({ getPlacements: () => props.placements, onDrop: handleDrop })
  await nextTick()
  registerColumns()
  scrollToMorning()
})

watch(
  () => props.day,
  async () => {
    await nextTick()
    registerColumns()
    scrollToMorning()
  }
)
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col bg-white" data-export-root>
    <div class="cal-head border-b border-slate-200" style="grid-template-columns: 56px 1fr">
      <div />
      <div class="flex items-center gap-2 border-l border-slate-100 px-3 py-2">
        <span class="text-[12px] text-slate-500">{{ weekdayShort(day) }}</span>
        <span
          class="text-[17px] font-semibold"
          :class="day === today ? 'text-blue-600' : 'text-slate-900'"
        >
          {{ dayNumber(day) }}
        </span>
        <span
          v-if="day === today"
          class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600"
        >
          今天
        </span>
      </div>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto overflow-x-hidden" data-export-scroll>
      <div ref="body" class="cal-body" style="grid-template-columns: 56px 1fr">
        <div class="gutter">
          <span v-for="hour in 24" :key="hour" :style="{ top: `${(hour - 1) * HOUR_PX}px` }">
            {{ String(hour - 1).padStart(2, '0') }}:00
          </span>
        </div>

        <div class="cal-col">
          <EventCard
            v-for="event in eventsOf(day)"
            :key="event.placement.id"
            :task="event.task"
            :placement="event.placement"
            @open="emit('open-task', $event)"
          />

          <div
            v-if="drag.active && drag.day === day"
            data-testid="drag-preview"
            class="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-md border-[1.5px] border-dashed"
            :class="drag.valid ? 'border-blue-500 bg-blue-500/10' : 'border-rose-500 bg-rose-500/10'"
            :style="{ top: `${(drag.start / 60) * HOUR_PX}px`, height: `${(drag.duration / 60) * HOUR_PX}px` }"
          />
        </div>
      </div>
    </div>
  </section>
</template>

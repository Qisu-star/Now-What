<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Placement, Task } from '@nowwhat/shared'
import { ApiError, createPlacement, updatePlacement } from '../api'
import { dayNumber, todayLocal, weekDays, weekdayIndex, weekdayShort } from '../format'
import { toast } from '../toast'
import { configureDrag, drag, HOUR_PX, setDragColumns, type DragPayload } from '../drag'
import EventCard from './EventCard.vue'

const props = defineProps<{ weekStart: string; tasks: Task[]; placements: Placement[] }>()
const emit = defineEmits<{ changed: []; 'open-task': [taskId: string] }>()

const scroller = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)

const days = computed(() => weekDays(props.weekStart))
const today = todayLocal()
const gridStyle = computed(() => ({
  gridTemplateColumns: `56px repeat(${days.value.length}, 1fr)`
}))

const tasksById = computed(() => new Map(props.tasks.map((task) => [task.id, task])))

interface DayEvent {
  placement: Placement
  task: Task
}

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
  const elements = body.value?.querySelectorAll<HTMLElement>('.cal-col') ?? []
  setDragColumns(
    days.value
      .map((day, index) => ({ day, el: elements[index] }))
      .filter((item): item is { day: string; el: HTMLElement } => Boolean(item.el))
  )
}

function scrollToMorning(): void {
  if (scroller.value) scroller.value.scrollTop = 8 * HOUR_PX - 8
}

async function handleDrop(payload: DragPayload): Promise<void> {
  if (!payload.valid) {
    toast('该时段已被占用')
    return
  }

  try {
    if (payload.mode === 'create') {
      await createPlacement({
        taskId: payload.taskId,
        day: payload.day,
        startMinute: payload.start,
        endMinute: payload.end
      })
      toast('已安排')
    } else if (payload.placementId) {
      await updatePlacement(payload.placementId, {
        day: payload.day,
        startMinute: payload.start,
        endMinute: payload.end
      })
      toast('已调整')
    }
    emit('changed')
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast('该时段已被占用')
    } else {
      toast(error instanceof Error ? error.message : '操作失败')
    }
    emit('changed')
  }
}

onMounted(async () => {
  configureDrag({ getPlacements: () => props.placements, onDrop: handleDrop })
  await nextTick()
  registerColumns()
  scrollToMorning()
})

watch(
  () => props.weekStart,
  async () => {
    await nextTick()
    registerColumns()
    scrollToMorning()
  }
)
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col bg-white">
    <div class="cal-head border-b border-slate-200" :style="gridStyle">
      <div />
      <div
        v-for="day in days"
        :key="day"
        class="border-l border-slate-100 px-2 py-2 text-center"
      >
        <span class="block text-[11.5px]" :class="day === today ? 'text-blue-600' : 'text-slate-500'">
          {{ weekdayShort(day) }}
        </span>
        <span
          class="block text-[17px] font-semibold leading-tight"
          :class="day === today ? 'text-blue-600' : 'text-slate-900'"
        >
          {{ dayNumber(day) }}
        </span>
      </div>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto overflow-x-hidden">
      <div ref="body" class="cal-body" :style="gridStyle">
        <div class="gutter">
          <span v-for="hour in 24" :key="hour" :style="{ top: `${(hour - 1) * HOUR_PX}px` }">
            {{ String(hour - 1).padStart(2, '0') }}:00
          </span>
        </div>

        <div
          v-for="day in days"
          :key="day"
          class="cal-col"
          :class="{ weekend: weekdayIndex(day) >= 5 }"
        >
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

<style scoped>
.cal-head {
  display: grid;
  height: 57px;
  flex: 0 0 57px;
}

.cal-body {
  display: grid;
  height: calc(24 * 56px);
  position: relative;
}

.gutter {
  position: relative;
  border-right: 1px solid #eff1f4;
}

.gutter span {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: #98a0ac;
  font-variant-numeric: tabular-nums;
}

.gutter span:first-child {
  transform: none;
}

.cal-col {
  position: relative;
  border-left: 1px solid #eff1f4;
  background-image: repeating-linear-gradient(to bottom, #eff1f4 0 1px, transparent 1px 56px);
}

.cal-col.weekend {
  background-color: #fafbfc;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { Placement, Task } from '@nowwhat/shared'
import { PRIORITY_META, taskColor } from '../theme'
import { localParts } from '../format'
import { beginPlacementDrag, flags } from '../drag'

const props = defineProps<{ task: Task; placement: Placement }>()
const emit = defineEmits<{ open: [taskId: string] }>()

const height = computed(
  () => ((props.placement.endMinute - props.placement.startMinute) / 60) * 56
)
const density = computed(() =>
  height.value < 44 ? 'compact' : height.value >= 76 ? 'tall' : 'standard'
)
/** 太矮的卡片放不下把手，只能移动；时长调整走详情里的手动录入 */
const resizable = computed(() => height.value >= 40)
const archived = computed(() => props.task.status === 'archived')

const color = computed(() => taskColor(props.task.color))
const priority = computed(() => PRIORITY_META[props.task.priority])

/** 同一天只显示时分，跨天补上月/日 */
const deadline = computed(() => {
  const end = localParts(props.task.endAt)
  if (end.date === props.placement.day) return end.time
  const [, month, date] = end.date.split('-')
  return `${Number(month)}/${Number(date)} ${end.time}`
})

const style = computed(() => ({
  top: `${(props.placement.startMinute / 60) * 56}px`,
  height: `${Math.max(height.value - 1, 14)}px`,
  borderLeftColor: color.value,
  backgroundColor: `color-mix(in srgb, ${color.value} 9%, white)`
}))

function onClick(): void {
  if (flags.suppressClick) return
  emit('open', props.task.id)
}

function onBodyPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  beginPlacementDrag(props.placement, 'move', event)
}

function onHandlePointerDown(edge: 'resize-start' | 'resize-end', event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  beginPlacementDrag(props.placement, edge, event)
}
</script>

<template>
  <div class="ev" :class="[density, { archived }]" :style="style" @pointerdown="onBodyPointerDown" @click="onClick">
    <span
      v-if="resizable"
      class="handle top"
      aria-hidden="true"
      @pointerdown="onHandlePointerDown('resize-start', $event)"
    />
    <span
      v-if="resizable"
      class="handle bottom"
      aria-hidden="true"
      @pointerdown="onHandlePointerDown('resize-end', $event)"
    />
    <template v-if="density === 'compact'">
      <span class="h-1.5 w-1.5 flex-none rounded-full" :class="priority.dot" />
      <span class="ev-title min-w-0 flex-1 truncate text-[10.5px] text-slate-900">{{ task.title }}</span>
      <span class="flex-none text-[9.5px] tabular-nums text-slate-500">{{ deadline }}</span>
    </template>
    <template v-else>
      <div class="flex items-center gap-1.5">
        <span class="ev-title min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900">
          {{ task.title }}
        </span>
        <span
          class="flex-none rounded px-1 text-[9.5px] font-semibold leading-4 text-white"
          :class="priority.chip"
        >
          {{ priority.label }}
        </span>
      </div>
      <div class="truncate text-[10px] tabular-nums text-slate-500">截止 {{ deadline }}</div>
      <div v-if="density === 'tall'" class="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-slate-700">
        {{ task.description }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.ev {
  position: absolute;
  left: 2px;
  right: 2px;
  overflow: hidden;
  padding: 3px 6px;
  border-left: 3px solid;
  border-radius: 6px;
  box-shadow: 0 1px 1px rgb(16 24 40 / 5%);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.ev:hover {
  filter: brightness(0.98);
}

.ev:active {
  cursor: grabbing;
}

.handle {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2;
  height: 6px;
  cursor: ns-resize;
}

.handle::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: rgb(15 23 42 / 18%);
  opacity: 0;
  transform: translateX(-50%);
}

.handle:hover::after {
  opacity: 1;
}

.handle.top {
  top: 0;
}

.handle.top::after {
  top: 2px;
}

.handle.bottom {
  bottom: 0;
}

.handle.bottom::after {
  bottom: 2px;
}

.ev.archived {
  filter: grayscale(1);
  opacity: 0.55;
}

.ev.archived .ev-title {
  text-decoration: line-through;
}

.ev.compact {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 5px;
}
</style>

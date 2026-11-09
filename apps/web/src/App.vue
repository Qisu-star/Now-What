<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { PRIORITIES, sortTasks, type Placement, type Task } from '@nowwhat/shared'
import { fetchPlacements, fetchTasks } from './api'
import { addDays, monthDay, startOfWeek, todayLocal } from './format'
import { toast, toastMessage } from './toast'
import { PRIORITY_META } from './theme'
import WeekView from './components/WeekView.vue'
import TaskCard from './components/TaskCard.vue'
import TaskFormModal from './components/TaskFormModal.vue'
import TaskDetailModal from './components/TaskDetailModal.vue'

const tasks = ref<Task[]>([])
const placements = ref<Placement[]>([])
const weekStart = ref(startOfWeek(todayLocal()))
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref<Task | null>(null)
const detailId = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const from = weekStart.value
    const to = addDays(from, 6)
    const [taskList, placementList] = await Promise.all([fetchTasks(), fetchPlacements(from, to)])
    tasks.value = taskList
    placements.value = placementList
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch(weekStart, load)

const weekLabel = computed(
  () => `${monthDay(weekStart.value)} – ${monthDay(addDays(weekStart.value, 6))}`
)

const groups = computed(() =>
  PRIORITIES.map((priority) => ({
    priority,
    items: sortTasks(tasks.value.filter((task) => task.priority === priority))
  })).filter((group) => group.items.length > 0)
)

function shiftWeek(offset: number): void {
  weekStart.value = addDays(weekStart.value, offset)
}

function goToday(): void {
  weekStart.value = startOfWeek(todayLocal())
}

function openCreate(): void {
  editing.value = null
  showForm.value = true
}

function openDetail(id: string): void {
  detailId.value = id
}

function onSaved(): void {
  showForm.value = false
  editing.value = null
  void load()
  toast('已保存')
}

function onEdit(task: Task): void {
  detailId.value = null
  editing.value = task
  showForm.value = true
}

function onDeleted(): void {
  detailId.value = null
  void load()
  toast('已删除')
}

onMounted(() => {
  const query = new URLSearchParams(location.search)
  const ui = query.get('ui')
  if (ui === 'create') showForm.value = true
  if (ui === 'detail') {
    const id = query.get('id')
    if (id) detailId.value = id
  }
  void load()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header class="flex h-14 flex-none items-center gap-4 border-b border-slate-200 bg-white px-4">
      <div class="flex items-center gap-2.5">
        <span
          class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 8.2V12l2.6 1.7" />
          </svg>
        </span>
        <span class="text-sm font-semibold tracking-tight">Now What</span>
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <button
          class="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          title="上一周"
          @click="shiftWeek(-7)"
        >
          ‹
        </button>
        <span class="min-w-[168px] text-center text-sm font-semibold tabular-nums">
          {{ weekLabel }}
        </span>
        <button
          class="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          title="下一周"
          @click="shiftWeek(7)"
        >
          ›
        </button>
        <button
          class="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          @click="goToday"
        >
          今天
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <WeekView
        :week-start="weekStart"
        :tasks="tasks"
        :placements="placements"
        @changed="load"
        @open-task="openDetail"
      />

      <aside class="flex w-[380px] flex-none flex-col border-l border-slate-200 bg-white">
        <div class="flex h-14 flex-none items-center justify-between border-b border-slate-200 px-4">
          <div class="flex items-baseline gap-2">
            <h2 class="text-sm font-semibold">事务</h2>
            <span class="text-xs text-slate-400">{{ tasks.length }}</span>
          </div>
          <button
            class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            data-testid="new-task"
            @click="openCreate"
          >
            ＋ 新建
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-3 py-3">
          <p v-if="loading && tasks.length === 0" class="py-12 text-center text-sm text-slate-500">
            加载中…
          </p>

          <div
            v-else-if="error"
            class="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {{ error }}
            <button class="ml-1 underline" @click="load">重试</button>
          </div>

          <div
            v-else-if="groups.length === 0"
            class="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500"
          >
            还没有事务
          </div>

          <div v-else>
            <section v-for="group in groups" :key="group.priority" class="mb-4">
              <div class="mb-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span class="h-1.5 w-1.5 rounded-full" :class="PRIORITY_META[group.priority].dot" />
                <span class="font-semibold text-slate-700">{{ PRIORITY_META[group.priority].label }}</span>
                <span>{{ group.items.length }}</span>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <TaskCard v-for="task in group.items" :key="task.id" :task="task" @open="openDetail" />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>

    <TaskFormModal v-if="showForm" :task="editing" @saved="onSaved" @cancel="showForm = false" />
    <TaskDetailModal
      v-if="detailId"
      :task-id="detailId"
      @close="detailId = null"
      @edit="onEdit"
      @deleted="onDeleted"
    />

    <div
      v-if="toastMessage"
      class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

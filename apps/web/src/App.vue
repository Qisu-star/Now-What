<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PRIORITIES, sortTasks, type Placement, type Task } from '@nowwhat/shared'
import { fetchPlacements, fetchTasks } from './api'
import {
  addDays,
  addMonths,
  dayLabel,
  fmtDateTime,
  monthDay,
  monthLabel,
  monthStart,
  startOfWeek,
  todayLocal
} from './format'
import { toast, toastMessage } from './toast'
import { onRemoteChange } from './sync'
import { PRIORITY_META } from './theme'
import DayView from './components/DayView.vue'
import WeekView from './components/WeekView.vue'
import MonthView from './components/MonthView.vue'
import TaskCard from './components/TaskCard.vue'
import TaskFormModal from './components/TaskFormModal.vue'
import TaskDetailModal from './components/TaskDetailModal.vue'

type ViewId = 'day' | 'week' | 'month'

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' }
]

const tasks = ref<Task[]>([])
const placements = ref<Placement[]>([])
const isCompact = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
const view = ref<ViewId>(isCompact ? 'day' : 'week')
const anchor = ref(todayLocal())
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref<Task | null>(null)
const detailId = ref<string | null>(null)
const mobileListOpen = ref(false)
const tab = ref<'todo' | 'history'>('todo')
const historySort = ref<'completed' | 'title'>('completed')

const weekStart = computed(() => startOfWeek(anchor.value))
const monthAnchor = computed(() => monthStart(anchor.value))

const range = computed(() => {
  if (view.value === 'day') return { from: anchor.value, to: anchor.value }
  if (view.value === 'week') {
    return { from: weekStart.value, to: addDays(weekStart.value, 6) }
  }
  const start = startOfWeek(monthAnchor.value)
  return { from: start, to: addDays(start, 41) }
})

const title = computed(() => {
  if (view.value === 'day') return dayLabel(anchor.value)
  if (view.value === 'week') {
    return `${monthDay(weekStart.value)} – ${monthDay(addDays(weekStart.value, 6))}`
  }
  return monthLabel(anchor.value)
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const { from, to } = range.value
    const [activeList, archivedList, placementList] = await Promise.all([
      fetchTasks('active'),
      fetchTasks('archived'),
      fetchPlacements(from, to)
    ])
    tasks.value = [...activeList, ...archivedList]
    placements.value = placementList
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch([view, anchor], load)

const activeTasks = computed(() => tasks.value.filter((task) => task.status === 'active'))
const archivedTasks = computed(() => tasks.value.filter((task) => task.status === 'archived'))

const groups = computed(() =>
  PRIORITIES.map((priority) => ({
    priority,
    items: sortTasks(activeTasks.value.filter((task) => task.priority === priority))
  })).filter((group) => group.items.length > 0)
)

const historyList = computed(() => {
  const list = [...archivedTasks.value]
  if (historySort.value === 'title') {
    return list.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  }
  return list.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
})

function shift(step: number): void {
  if (view.value === 'day') anchor.value = addDays(anchor.value, step)
  else if (view.value === 'week') anchor.value = addDays(anchor.value, step * 7)
  else anchor.value = addMonths(anchor.value, step)
}

function goToday(): void {
  anchor.value = todayLocal()
}

function onEnterView(kind: 'day' | 'week', day: string): void {
  anchor.value = day
  view.value = kind
}

async function onExportTable(): Promise<void> {
  try {
    const { exportXlsx } = await import('./export')
    exportXlsx(view.value, anchor.value, tasks.value, placements.value)
  } catch {
    toast('导出失败')
  }
}

async function onExportImage(): Promise<void> {
  const node = document.querySelector<HTMLElement>('[data-export-root]')
  if (!node) {
    toast('导出失败')
    return
  }
  try {
    const { exportPng } = await import('./export')
    await exportPng(node, view.value, anchor.value)
  } catch {
    toast('导出失败')
  }
}

function openCreate(): void {
  editing.value = null
  showForm.value = true
  mobileListOpen.value = false
}

function openDetail(id: string): void {
  detailId.value = id
  mobileListOpen.value = false
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

function onArchived(released: number): void {
  detailId.value = null
  void load()
  toast(released > 0 ? `已归档，释放 ${released} 个未来安排` : '已归档')
}

let stopRemoteSync: (() => void) | null = null

function onVisibilityChange(): void {
  if (!document.hidden) void load()
}

onMounted(() => {
  stopRemoteSync = onRemoteChange(() => {
    void load()
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onVisibilityChange)

  const query = new URLSearchParams(location.search)
  const ui = query.get('ui')
  if (ui === 'create') showForm.value = true
  if (ui === 'detail') {
    const id = query.get('id')
    if (id) detailId.value = id
  }
  void load()
})

onUnmounted(() => {
  stopRemoteSync?.()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('focus', onVisibilityChange)
})
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header class="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2 md:h-14 md:flex-nowrap md:py-0">
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
        <span class="hidden text-sm font-semibold tracking-tight sm:inline">Now What</span>
      </div>

      <div class="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
        <button
          v-for="item in VIEWS"
          :key="item.id"
          :data-testid="`view-${item.id}`"
          class="rounded-md px-2.5 py-1 text-xs transition"
          :class="
            view === item.id
              ? 'bg-white font-semibold text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          "
          @click="view = item.id"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="ml-auto flex w-full items-center justify-end gap-1.5 md:w-auto">
        <button
          class="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          title="上一页"
          @click="shift(-1)"
        >
          ‹
        </button>
        <span class="min-w-[110px] text-center text-xs font-semibold tabular-nums sm:min-w-[168px] sm:text-sm">
          {{ title }}
        </span>
        <button
          class="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          title="下一页"
          @click="shift(1)"
        >
          ›
        </button>
        <button
          class="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          @click="goToday"
        >
          今天
        </button>
        <button
          data-testid="export-xlsx"
          class="hidden rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 md:inline-block"
          title="导出当前视图为表格"
          @click="onExportTable"
        >
          导出表格
        </button>
        <button
          data-testid="export-png"
          class="hidden rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 md:inline-block"
          title="导出当前视图为图片"
          @click="onExportImage"
        >
          导出图片
        </button>
        <button
          data-testid="open-list"
          class="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 md:hidden"
          @click="mobileListOpen = true"
        >
          事务
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <DayView
        v-if="view === 'day'"
        :day="anchor"
        :tasks="tasks"
        :placements="placements"
        @changed="load"
        @open-task="openDetail"
      />
      <WeekView
        v-else-if="view === 'week'"
        :week-start="weekStart"
        :tasks="tasks"
        :placements="placements"
        @changed="load"
        @open-task="openDetail"
      />
      <MonthView
        v-else
        :month="monthAnchor"
        :tasks="tasks"
        :placements="placements"
        @open-task="openDetail"
        @enter-view="onEnterView"
      />

      <div
        v-if="mobileListOpen"
        class="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
        @click="mobileListOpen = false"
      />

      <aside
        class="fixed inset-y-0 right-0 z-40 flex w-[86vw] max-w-[380px] flex-none flex-col border-l border-slate-200 bg-white transition-transform md:static md:z-auto md:w-[380px] md:max-w-none md:translate-x-0"
        :class="mobileListOpen ? 'translate-x-0' : 'translate-x-full'"
      >
        <div class="flex h-14 flex-none items-center justify-between border-b border-slate-200 px-3">
          <div class="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            <button
              data-testid="tab-todo"
              class="rounded-md px-2.5 py-1 text-xs transition"
              :class="tab === 'todo' ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="tab = 'todo'"
            >
              待办 {{ activeTasks.length }}
            </button>
            <button
              data-testid="tab-history"
              class="rounded-md px-2.5 py-1 text-xs transition"
              :class="tab === 'history' ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="tab = 'history'"
            >
              历史 {{ archivedTasks.length }}
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              data-testid="new-task"
              class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
              @click="openCreate"
            >
              ＋ 新建
            </button>
            <button
              data-testid="close-list"
              class="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-50 md:hidden"
              @click="mobileListOpen = false"
            >
              ✕
            </button>
          </div>
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

          <template v-else-if="tab === 'todo'">
            <div
              v-if="activeTasks.length === 0"
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
          </template>

          <template v-else>
            <div class="mb-2 flex items-center justify-between px-1">
              <span class="text-[11px] text-slate-400">共 {{ archivedTasks.length }} 条</span>
              <div class="flex items-center gap-1 text-[11px]">
                <button
                  data-testid="sort-completed"
                  class="transition"
                  :class="historySort === 'completed' ? 'font-semibold text-slate-700' : 'text-slate-400 hover:text-slate-600'"
                  @click="historySort = 'completed'"
                >
                  完成时间
                </button>
                <span class="text-slate-300">/</span>
                <button
                  data-testid="sort-title"
                  class="transition"
                  :class="historySort === 'title' ? 'font-semibold text-slate-700' : 'text-slate-400 hover:text-slate-600'"
                  @click="historySort = 'title'"
                >
                  名称
                </button>
              </div>
            </div>

            <div
              v-if="historyList.length === 0"
              class="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500"
            >
              还没有归档的事务
            </div>

            <div v-else class="flex flex-col gap-2">
              <button
                v-for="task in historyList"
                :key="task.id"
                data-testid="history-item"
                class="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-white"
                @click="openDetail(task.id)"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-500 line-through decoration-slate-400"
                  >
                    {{ task.title }}
                  </span>
                  <span
                    class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-70"
                    :class="PRIORITY_META[task.priority].chip"
                  >
                    {{ PRIORITY_META[task.priority].label }}
                  </span>
                </div>
                <span class="text-[11px] text-slate-400">
                  完成于 {{ task.completedAt ? fmtDateTime(task.completedAt) : '—' }}
                </span>
              </button>
            </div>
          </template>
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
      @changed="load"
      @archived="onArchived"
    />

    <div
      v-if="toastMessage"
      class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

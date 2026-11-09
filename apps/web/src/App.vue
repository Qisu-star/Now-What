<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PRIORITIES, sortTasks, type Task } from '@nowwhat/shared'
import { fetchTasks } from './api'
import { PRIORITY_META } from './theme'
import TaskCard from './components/TaskCard.vue'
import TaskFormModal from './components/TaskFormModal.vue'
import TaskDetailModal from './components/TaskDetailModal.vue'

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref<Task | null>(null)
const detailId = ref<string | null>(null)
const toast = ref('')

let toastTimer = 0

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    tasks.value = await fetchTasks()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function flash(message: string): void {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 1800)
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
  flash('已保存')
}

function onEdit(task: Task): void {
  detailId.value = null
  editing.value = task
  showForm.value = true
}

function onDeleted(): void {
  detailId.value = null
  void load()
  flash('已删除')
}

const groups = computed(() =>
  PRIORITIES.map((priority) => ({
    priority,
    items: sortTasks(tasks.value.filter((task) => task.priority === priority))
  })).filter((group) => group.items.length > 0)
)

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
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
            <svg
              width="20"
              height="20"
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
          <div>
            <h1 class="text-base font-semibold tracking-tight">Now What</h1>
            <p class="text-xs text-slate-500">把要做的事，安排进日程</p>
          </div>
        </div>

        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          @click="openCreate"
        >
          ＋ 新建事务
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-8">
      <div class="mb-4 flex items-baseline justify-between">
        <h2 class="text-sm font-semibold text-slate-700">未完成事务</h2>
        <span class="text-xs text-slate-400">{{ tasks.length }} 项</span>
      </div>

      <p v-if="loading" class="py-16 text-center text-sm text-slate-500">加载中…</p>

      <div
        v-else-if="error"
        class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      >
        {{ error }}
        <button class="ml-2 underline" @click="load">重试</button>
      </div>

      <div
        v-else-if="groups.length === 0"
        class="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center"
      >
        <p class="text-sm text-slate-500">还没有事务</p>
        <button
          class="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          @click="openCreate"
        >
          创建第一个事务
        </button>
      </div>

      <div v-else>
        <section v-for="group in groups" :key="group.priority" class="mb-6">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <span class="h-1.5 w-1.5 rounded-full" :class="PRIORITY_META[group.priority].dot" />
            <span class="font-semibold text-slate-700">{{ PRIORITY_META[group.priority].label }}</span>
            <span>{{ group.items.length }}</span>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TaskCard v-for="task in group.items" :key="task.id" :task="task" @open="openDetail" />
          </div>
        </section>
      </div>
    </main>

    <TaskFormModal v-if="showForm" :task="editing" @saved="onSaved" @cancel="showForm = false" />
    <TaskDetailModal
      v-if="detailId"
      :task-id="detailId"
      @close="detailId = null"
      @edit="onEdit"
      @deleted="onDeleted"
    />

    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
    >
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getHealth, type Health } from './api'

type Status = 'loading' | 'ok' | 'error'

const status = ref<Status>('loading')
const health = ref<Health | null>(null)
const errorMessage = ref('')

async function load(): Promise<void> {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    health.value = await getHealth()
    status.value = 'ok'
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(load)

const panelClass = computed(() => {
  if (status.value === 'ok') return 'bg-emerald-50 ring-1 ring-emerald-100'
  if (status.value === 'error') return 'bg-rose-50 ring-1 ring-rose-100'
  return 'bg-slate-50 ring-1 ring-slate-100'
})

const dotClass = computed(() => {
  if (status.value === 'ok') return 'bg-emerald-500'
  if (status.value === 'error') return 'bg-rose-500'
  return 'bg-slate-400'
})

const titleClass = computed(() => {
  if (status.value === 'ok') return 'text-emerald-900'
  if (status.value === 'error') return 'text-rose-900'
  return 'text-slate-700'
})

const title = computed(() => {
  if (status.value === 'loading') return '正在连接服务…'
  return status.value === 'ok' ? '服务正常' : '无法连接服务'
})

const detail = computed(() => {
  if (status.value === 'ok') return `API 与数据库可用 · 服务端时间 ${health.value?.time ?? ''}`
  if (status.value === 'error') return errorMessage.value || '请确认 API 已启动'
  return '正在请求 /api/v1/health'
})
</script>

<template>
  <div class="flex min-h-screen justify-center bg-slate-50 px-6 py-16 text-slate-900">
    <main class="w-full max-w-lg">
      <header class="flex items-center gap-3">
        <span
          class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm"
        >
          <svg
            width="22"
            height="22"
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
          <h1 class="text-lg font-semibold tracking-tight">Now What</h1>
          <p class="text-xs text-slate-500">把要做的事，安排进日程</p>
        </div>
      </header>

      <section class="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
        <h2 class="text-sm font-medium text-slate-700">环境自检</h2>
        <p class="mt-1 text-xs text-slate-500">Vue → Fastify → SQLite</p>

        <div class="mt-5 flex items-center gap-3 rounded-xl px-4 py-3" :class="panelClass">
          <span class="relative flex h-2.5 w-2.5">
            <span
              v-if="status === 'loading'"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-60"
            />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="dotClass" />
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :class="titleClass">{{ title }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500">{{ detail }}</p>
          </div>

          <button
            v-if="status === 'error'"
            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            @click="load"
          >
            重试
          </button>
        </div>
      </section>

      <p class="mt-6 text-center text-[11px] text-slate-400">M0 · 脚手架验证</p>
    </main>
  </div>
</template>

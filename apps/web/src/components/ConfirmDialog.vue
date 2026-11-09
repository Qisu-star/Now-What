<script setup lang="ts">
import { onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    tone?: 'default' | 'danger'
  }>(),
  { description: '', confirmText: '确认', cancelText: '取消', tone: 'default' }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const cancelButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  // 默认聚焦「取消」，避免回车误触危险操作
  cancelButton.value?.focus()
})
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
    @click.self="emit('cancel')"
  >
    <div
      class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <h3 class="text-base font-semibold text-slate-900">{{ title }}</h3>
      <p v-if="description" class="mt-2 text-sm leading-relaxed text-slate-600">{{ description }}</p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          ref="cancelButton"
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          @click="emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          :class="
            tone === 'danger'
              ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300'
              : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-300'
          "
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

import { ref } from 'vue'

export const toastMessage = ref('')

let timer = 0

export function toast(message: string): void {
  toastMessage.value = message
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 1800)
}

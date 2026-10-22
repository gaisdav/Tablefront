import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, ref } from 'vue'

export interface Toast {
  id: number
  kind: 'info' | 'error'
  message: string
}

/** Long enough to read; errors stay a little longer because they usually need a decision. */
const LIFETIME_MS = { info: 4000, error: 8000 } as const

/**
 * Short messages that belong to no page: "the change was rejected, here is why". They disappear on
 * their own and can be dismissed. The host component decides how they are announced.
 */
export const useToastsStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextId = 1

  function dismiss(id: number): void {
    clearTimeout(timers.get(id))
    timers.delete(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(kind: Toast['kind'], message: string): void {
    const id = nextId++
    toasts.value = [...toasts.value, { id, kind, message }]
    timers.set(
      id,
      setTimeout(() => {
        dismiss(id)
      }, LIFETIME_MS[kind]),
    )
  }

  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    })
  }

  return {
    toasts,
    info: (message: string) => {
      push('info', message)
    },
    error: (message: string) => {
      push('error', message)
    },
    dismiss,
  }
})

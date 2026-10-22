import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastsStore } from '@/stores/toasts'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toasts', () => {
  it('shows a message and removes it by itself', () => {
    const toasts = useToastsStore()

    toasts.info('Saved')
    expect(toasts.toasts).toMatchObject([{ kind: 'info', message: 'Saved' }])

    vi.advanceTimersByTime(4000)
    expect(toasts.toasts).toEqual([])
  })

  it('keeps an error longer than an ordinary message', () => {
    const toasts = useToastsStore()

    toasts.error('Not saved')
    vi.advanceTimersByTime(4000)
    expect(toasts.toasts).toHaveLength(1)

    vi.advanceTimersByTime(4000)
    expect(toasts.toasts).toEqual([])
  })

  it('can be dismissed early, and the others stay', () => {
    const toasts = useToastsStore()
    toasts.info('One')
    toasts.info('Two')
    const [first] = toasts.toasts

    toasts.dismiss(first?.id ?? -1)

    expect(toasts.toasts.map((toast) => toast.message)).toEqual(['Two'])
  })

  it('gives every toast its own id', () => {
    const toasts = useToastsStore()

    toasts.info('A')
    toasts.info('A')

    expect(new Set(toasts.toasts.map((toast) => toast.id)).size).toBe(2)
  })
})

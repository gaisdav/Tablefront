import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedRef } from '@/composables/useDebouncedRef'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedRef', () => {
  it('starts with the source value', () => {
    expect(useDebouncedRef(ref('pizza'), 300).value).toBe('pizza')
  })

  it('updates only after the source has been quiet for the delay', async () => {
    const source = ref('')
    const debounced = useDebouncedRef(source, 300)

    source.value = 'pizza'
    await nextTick()
    vi.advanceTimersByTime(299)
    expect(debounced.value).toBe('')

    vi.advanceTimersByTime(1)
    expect(debounced.value).toBe('pizza')
  })

  it('collapses a burst of changes into one update with the last value', async () => {
    const source = ref('')
    const debounced = useDebouncedRef(source, 300)
    const seen: string[] = []

    for (const text of ['p', 'pi', 'piz', 'pizz', 'pizza']) {
      source.value = text
      await nextTick()
      vi.advanceTimersByTime(100) // each keystroke arrives before the delay is up
      seen.push(debounced.value)
    }
    expect(seen).toEqual(['', '', '', '', ''])

    vi.advanceTimersByTime(300)
    expect(debounced.value).toBe('pizza')
  })

  it('does not fire after its scope is disposed', async () => {
    const source = ref('')
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedRef(source, 300))

    source.value = 'pizza'
    await nextTick()
    scope.stop()
    vi.advanceTimersByTime(1000)

    expect(debounced?.value).toBe('')
  })
})

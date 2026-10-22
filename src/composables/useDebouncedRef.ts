import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

/**
 * A copy of `source` that only updates once `source` has stayed unchanged for `delayMs`.
 * Typing "pizza" fast yields one update, not five.
 */
export function useDebouncedRef<T>(source: Ref<T>, delayMs: number): Readonly<ShallowRef<T>> {
  const debounced = shallowRef(source.value)
  let timer: ReturnType<typeof setTimeout> | undefined

  // Side effect: schedules the delayed update.
  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delayMs)
  })
  onScopeDispose(() => {
    clearTimeout(timer)
  })

  return debounced
}

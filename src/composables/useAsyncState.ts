import {
  getCurrentScope,
  onScopeDispose,
  shallowRef,
  watch,
  type ShallowRef,
  type WatchSource,
} from 'vue'

export interface UseAsyncStateOptions {
  /** Run once on creation. Default: true. */
  immediate?: boolean
  /** Run again, cancelling the run in flight, whenever any of these change. */
  watch?: WatchSource | WatchSource[]
}

export interface AsyncState<T> {
  /** The last successful result. Kept while a newer run is loading, so the UI need not flash empty. */
  data: Readonly<ShallowRef<T | undefined>>
  /** The last failure; cleared as soon as a new run starts. */
  error: Readonly<ShallowRef<Error | null>>
  /** True while a run is in flight, including re-runs that still have `data` to show. */
  isLoading: Readonly<ShallowRef<boolean>>
  /** Starts a run. Never rejects: failures end up in `error`. Resolves when the run has settled. */
  execute: () => Promise<void>
  /** Aborts the run in flight and ignores its result. */
  cancel: () => void
}

/**
 * Runs an async function and exposes its state.
 *
 * Only the latest run may touch the state: starting a run aborts the previous one, and a
 * run that is no longer current has its result dropped even if the fetcher ignores the signal.
 * That is what stops a slow response to an old search from overwriting a newer one.
 */
export function useAsyncState<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseAsyncStateOptions = {},
): AsyncState<T> {
  const data = shallowRef<T>()
  const error = shallowRef<Error | null>(null)
  const isLoading = shallowRef(false)
  let current: AbortController | null = null

  async function execute(): Promise<void> {
    current?.abort()
    const controller = new AbortController()
    current = controller
    isLoading.value = true
    error.value = null

    try {
      const result = await fetcher(controller.signal)
      if (current === controller) data.value = result
    } catch (caught) {
      // A superseded or cancelled run lands here with an AbortError; `current` has moved on.
      if (current === controller)
        error.value = caught instanceof Error ? caught : new Error(String(caught))
    } finally {
      if (current === controller) {
        isLoading.value = false
        current = null
      }
    }
  }

  function cancel(): void {
    current?.abort()
    current = null
    isLoading.value = false
  }

  if (options.watch !== undefined) {
    // Side effect: a changed input means the shown data is out of date, so fetch again.
    watch(options.watch, () => {
      void execute()
    })
  }
  if (options.immediate ?? true) void execute()
  if (getCurrentScope()) onScopeDispose(cancel)

  return { data, error, isLoading, execute, cancel }
}

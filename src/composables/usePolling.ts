import { getCurrentScope, onScopeDispose, shallowRef, type ShallowRef } from 'vue'

export interface UsePollingOptions<T> {
  /** Wait between a successful response and the next request. */
  intervalMs: number
  /** After this many milliseconds of back-off the wait stops growing. Default: 30 s. */
  maxBackoffMs?: number
  /** Polling ends for good when this returns true for a response (a terminal status). */
  shouldStop?: (data: T) => boolean
  /** Polling ends for good when this returns true for an error (retrying cannot help, e.g. a 404). */
  isFatal?: (error: Error) => boolean
}

export interface Polling<T> {
  /** The latest successful response; kept when later requests fail. */
  data: Readonly<ShallowRef<T | undefined>>
  /** The latest failure; cleared by the next success. */
  error: Readonly<ShallowRef<Error | null>>
  /** True until the first request has settled. */
  isLoading: Readonly<ShallowRef<boolean>>
  /** True once polling has ended for good (`shouldStop`, `isFatal` or `stop()`). */
  isStopped: Readonly<ShallowRef<boolean>>
  /** Requests now, and starts polling again if it had ended. */
  refresh: () => void
  /** Ends polling and cancels the request in flight. */
  stop: () => void
}

/**
 * Calls `fetcher` over and over until told to stop.
 *
 * - One request at a time: the next wait starts when the previous request has settled, so a slow
 *   server is never hit by overlapping requests.
 * - While the tab is hidden nothing new is requested; when it is shown again the next request
 *   goes out immediately, so the data is fresh when the user looks.
 * - After a failure the wait doubles (interval, 2x, 4x, ...) up to `maxBackoffMs`, and a success
 *   resets it. The last good `data` stays available throughout.
 * - It ends by itself when the component or effect scope that created it is disposed.
 */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UsePollingOptions<T>,
): Polling<T> {
  const { intervalMs, maxBackoffMs = 30_000, shouldStop, isFatal } = options

  const data = shallowRef<T>()
  const error = shallowRef<Error | null>(null)
  const isLoading = shallowRef(true)
  const isStopped = shallowRef(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | null = null
  let failures = 0

  function clearTimer(): void {
    clearTimeout(timer)
    timer = undefined
  }

  function schedule(): void {
    if (isStopped.value || document.hidden) return
    const wait = Math.min(maxBackoffMs, intervalMs * 2 ** failures)
    timer = setTimeout(() => void request(), wait)
  }

  async function request(): Promise<void> {
    clearTimer()
    if (isStopped.value || inFlight !== null || document.hidden) return
    const controller = new AbortController()
    inFlight = controller

    try {
      const result = await fetcher(controller.signal)
      if (inFlight !== controller) return
      data.value = result
      error.value = null
      failures = 0
      if (shouldStop?.(result) === true) {
        stop()
        return
      }
    } catch (caught) {
      if (inFlight !== controller) return
      const failure = caught instanceof Error ? caught : new Error(String(caught))
      error.value = failure
      failures += 1
      if (isFatal?.(failure) === true) {
        stop()
        return
      }
    }
    inFlight = null
    isLoading.value = false
    schedule()
  }

  function stop(): void {
    isStopped.value = true
    isLoading.value = false
    clearTimer()
    inFlight?.abort()
    inFlight = null
  }

  function refresh(): void {
    inFlight?.abort()
    inFlight = null
    isStopped.value = false
    failures = 0
    void request()
  }

  function onVisibilityChange(): void {
    // Hiding needs no work: a timer that fires while hidden does nothing and does not re-arm.
    if (!document.hidden && !isStopped.value) void request()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }

  void request()

  return { data, error, isLoading, isStopped, refresh, stop }
}

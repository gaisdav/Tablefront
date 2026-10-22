import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolling, type UsePollingOptions } from '@/composables/usePolling'

const INTERVAL = 1000

let hidden = false
function setHidden(value: boolean): void {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Runs usePolling in a scope the test can dispose, like a component's lifetime. */
function start<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: Partial<UsePollingOptions<T>> = {},
) {
  const scope = effectScope()
  const polling = scope.run(() => usePolling(fetcher, { intervalMs: INTERVAL, ...options }))
  if (polling === undefined) throw new Error('scope did not run')
  return { polling, scope }
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('usePolling: the loop', () => {
  it('requests at once, then again after every interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('a')
    const { polling } = start(fetcher)

    await tick(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(polling.data.value).toBe('a')
    expect(polling.isLoading.value).toBe(false)

    await tick(INTERVAL)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await tick(INTERVAL)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('never has two requests in flight: the wait starts when the response arrives', async () => {
    let finish: (value: string) => void = () => undefined
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    start(fetcher)

    await tick(INTERVAL * 5) // the first request is still pending
    expect(fetcher).toHaveBeenCalledTimes(1)

    finish('a')
    await tick(INTERVAL - 1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps showing the latest data', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    const { polling } = start(fetcher)

    await tick(0)
    expect(polling.data.value).toBe('a')
    await tick(INTERVAL)
    expect(polling.data.value).toBe('b')
  })
})

describe('usePolling: stopping', () => {
  it('stops for good when the response says it is final', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('working').mockResolvedValueOnce('done')
    const { polling } = start(fetcher, { shouldStop: (value) => value === 'done' })

    await tick(0)
    expect(polling.isStopped.value).toBe(false)
    await tick(INTERVAL)
    expect(polling.data.value).toBe('done')
    expect(polling.isStopped.value).toBe(true)

    await tick(INTERVAL * 10)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('stops on an error that retrying cannot fix, and keeps the error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('gone'))
    const { polling } = start(fetcher, { isFatal: (error) => error.message === 'gone' })

    await tick(0)
    expect(polling.isStopped.value).toBe(true)
    expect(polling.error.value?.message).toBe('gone')
    expect(polling.isLoading.value).toBe(false)

    await tick(INTERVAL * 10)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stop() cancels the request in flight and the next one', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((s: AbortSignal) => {
      signal = s
      return new Promise<string>(() => undefined)
    })
    const { polling } = start(fetcher)
    await tick(0)

    polling.stop()

    expect(signal?.aborted).toBe(true)
    await tick(INTERVAL * 10)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refresh() requests now and starts polling again after a stop', async () => {
    const fetcher = vi.fn().mockResolvedValue('a')
    const { polling } = start(fetcher)
    await tick(0)
    polling.stop()

    polling.refresh()
    await tick(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(polling.isStopped.value).toBe(false)

    await tick(INTERVAL)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

describe('usePolling: failures', () => {
  it('waits twice as long after each failure, up to a limit, and recovers on success', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValue('ok')
    const { polling } = start(fetcher, { maxBackoffMs: 3500 })

    await tick(0) // fails: next wait 2 s
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(1999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(1) // fails: next wait 4 s, capped to 3.5 s
    expect(fetcher).toHaveBeenCalledTimes(2)
    await tick(3499)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await tick(1) // fails again: the wait stays at the cap
    expect(fetcher).toHaveBeenCalledTimes(3)
    await tick(3499)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await tick(1) // succeeds
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(polling.error.value).toBeNull()

    await tick(INTERVAL) // back to the normal pace
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('keeps the last good data while requests fail', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockRejectedValue(new Error('down'))
    const { polling } = start(fetcher)

    await tick(0)
    await tick(INTERVAL)

    expect(polling.data.value).toBe('a')
    expect(polling.error.value?.message).toBe('down')
  })

  it('wraps a thrown non-Error', async () => {
    const fetcher = vi.fn().mockRejectedValue('boom')
    const { polling } = start(fetcher)

    await tick(0)

    expect(polling.error.value).toBeInstanceOf(Error)
  })
})

describe('usePolling: hidden tabs', () => {
  it('does not request while the tab is hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue('a')
    start(fetcher)
    await tick(0)

    setHidden(true)
    await tick(INTERVAL * 10)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('requests immediately when the tab is shown again, then carries on', async () => {
    const fetcher = vi.fn().mockResolvedValue('a')
    start(fetcher)
    await tick(0)
    setHidden(true)
    await tick(INTERVAL * 10)

    setHidden(false)
    await tick(0)
    expect(fetcher).toHaveBeenCalledTimes(2)

    await tick(INTERVAL)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not schedule after a response that arrives while hidden', async () => {
    let finish: (value: string) => void = () => undefined
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const { polling } = start(fetcher)
    await tick(0)

    setHidden(true)
    finish('a')
    await tick(INTERVAL * 10)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(polling.data.value).toBe('a')

    setHidden(false)
    await tick(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not wake up a poller that has stopped', async () => {
    const fetcher = vi.fn().mockResolvedValue('done')
    start(fetcher, { shouldStop: () => true })
    await tick(0)

    setHidden(true)
    setHidden(false)
    await tick(INTERVAL)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not start a second request when shown while one is in flight', async () => {
    const fetcher = vi.fn(() => new Promise<string>(() => undefined))
    start(fetcher)
    await tick(0)

    setHidden(true)
    setHidden(false)
    await tick(0)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('usePolling: cleanup', () => {
  it('stops everything when the scope is disposed', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((s: AbortSignal) => {
      signal = s
      return Promise.resolve('a')
    })
    const { scope } = start(fetcher)
    await tick(0)
    expect(fetcher).toHaveBeenCalledTimes(1)

    scope.stop()
    await tick(INTERVAL * 10)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(signal).toBeDefined()
  })

  it('aborts the request in flight when disposed', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((s: AbortSignal) => {
      signal = s
      return new Promise<string>(() => undefined)
    })
    const { scope } = start(fetcher)
    await tick(0)

    scope.stop()

    expect(signal?.aborted).toBe(true)
  })

  it('ignores the visibility of the tab after disposal', async () => {
    const fetcher = vi.fn().mockResolvedValue('a')
    const { scope } = start(fetcher)
    await tick(0)
    scope.stop()

    setHidden(true)
    setHidden(false)
    await tick(INTERVAL)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not write a late response into the state after disposal', async () => {
    let finish: (value: string) => void = () => undefined
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const { polling, scope } = start(fetcher)
    await tick(0)

    scope.stop()
    finish('late')
    await tick(0)

    expect(polling.data.value).toBeUndefined()
  })
})

import { flushPromises } from '@vue/test-utils'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAsyncState, type UseAsyncStateOptions } from '@/composables/useAsyncState'

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const scopes: EffectScope[] = []

/** Runs the composable inside an effect scope, like a component's setup would. */
function setup<T>(fetcher: (signal: AbortSignal) => Promise<T>, options?: UseAsyncStateOptions) {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useAsyncState(fetcher, options))
  if (state === undefined) throw new Error('scope did not run')
  return { state, scope }
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

describe('useAsyncState', () => {
  it('starts loading right away and exposes the result', async () => {
    const run = deferred<string>()
    const { state } = setup(() => run.promise)

    expect(state.isLoading.value).toBe(true)
    expect(state.data.value).toBeUndefined()

    run.resolve('menu')
    await flushPromises()

    expect(state.isLoading.value).toBe(false)
    expect(state.data.value).toBe('menu')
    expect(state.error.value).toBeNull()
  })

  it('waits for execute() when immediate is false', async () => {
    const fetcher = vi.fn(() => Promise.resolve('x'))
    const { state } = setup(fetcher, { immediate: false })

    expect(fetcher).not.toHaveBeenCalled()
    expect(state.isLoading.value).toBe(false)

    await state.execute()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(state.data.value).toBe('x')
  })

  it('stores a failure in error and never rejects', async () => {
    const failure = new Error('boom')
    const { state } = setup(() => Promise.reject(failure), { immediate: false })

    await expect(state.execute()).resolves.toBeUndefined()

    expect(state.error.value).toBe(failure)
    expect(state.isLoading.value).toBe(false)
    expect(state.data.value).toBeUndefined()
  })

  it('wraps a thrown non-Error so error is always an Error', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the point is a non-Error rejection
    const { state } = setup(() => Promise.reject('plain string'), { immediate: false })

    await state.execute()

    expect(state.error.value).toBeInstanceOf(Error)
    expect(state.error.value?.message).toBe('plain string')
  })

  it('clears the error when a retry starts, and recovers on success', async () => {
    let attempt = 0
    const { state } = setup(
      () => (++attempt === 1 ? Promise.reject(new Error('first')) : Promise.resolve('ok')),
      { immediate: false },
    )

    await state.execute()
    expect(state.error.value?.message).toBe('first')

    const retry = state.execute()
    expect(state.error.value).toBeNull()
    await retry

    expect(state.data.value).toBe('ok')
    expect(state.error.value).toBeNull()
  })

  it('keeps the previous data visible while a new run is loading', async () => {
    const runs = [deferred<string>(), deferred<string>()]
    let index = 0
    const { state } = setup(() => runs[index++]?.promise ?? Promise.reject(new Error('no run')))

    runs[0]?.resolve('first')
    await flushPromises()
    void state.execute()

    expect(state.isLoading.value).toBe(true)
    expect(state.data.value).toBe('first')
  })
})

describe('useAsyncState race conditions', () => {
  it('ignores an older response that arrives after a newer one', async () => {
    const runs = [deferred<string>(), deferred<string>()]
    let index = 0
    const { state } = setup(() => runs[index++]?.promise ?? Promise.reject(new Error('no run')), {
      immediate: false,
    })

    const older = state.execute() // e.g. results for "pi"
    const newer = state.execute() // e.g. results for "pizza"
    runs[1]?.resolve('pizza')
    await newer
    runs[0]?.resolve('pi')
    await older

    expect(state.data.value).toBe('pizza')
    expect(state.isLoading.value).toBe(false)
  })

  it('ignores an older failure that arrives after a newer success', async () => {
    const runs = [deferred<string>(), deferred<string>()]
    let index = 0
    const { state } = setup(() => runs[index++]?.promise ?? Promise.reject(new Error('no run')), {
      immediate: false,
    })

    const older = state.execute()
    const newer = state.execute()
    runs[1]?.resolve('fresh')
    await newer
    runs[0]?.reject(new Error('stale failure'))
    await older

    expect(state.data.value).toBe('fresh')
    expect(state.error.value).toBeNull()
  })

  it('stays loading until the newest run settles, not the first one', async () => {
    const runs = [deferred<string>(), deferred<string>()]
    let index = 0
    const { state } = setup(() => runs[index++]?.promise ?? Promise.reject(new Error('no run')), {
      immediate: false,
    })

    const older = state.execute()
    const newer = state.execute()
    runs[0]?.resolve('old')
    await older

    expect(state.isLoading.value).toBe(true)
    expect(state.data.value).toBeUndefined()

    runs[1]?.resolve('new')
    await newer
    expect(state.isLoading.value).toBe(false)
  })

  it('aborts the previous run when a new one starts', () => {
    const signals: AbortSignal[] = []
    const { state } = setup(
      (signal) => {
        signals.push(signal)
        return new Promise<string>(() => undefined)
      },
      { immediate: false },
    )

    void state.execute()
    void state.execute()

    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('does not report the abort of a superseded run as an error', async () => {
    const { state } = setup(
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
      { immediate: false },
    )

    const older = state.execute()
    void state.execute()
    await older

    expect(state.error.value).toBeNull()
  })
})

describe('useAsyncState cancellation', () => {
  it('cancel() aborts the run, stops loading and drops the result', async () => {
    const run = deferred<string>()
    let signal: AbortSignal | undefined
    const { state } = setup((s) => {
      signal = s
      return run.promise
    })

    state.cancel()
    run.resolve('late')
    await flushPromises()

    expect(signal?.aborted).toBe(true)
    expect(state.isLoading.value).toBe(false)
    expect(state.data.value).toBeUndefined()
  })

  it('aborts and ignores the run when the owning scope is disposed (component unmount)', async () => {
    const run = deferred<string>()
    let signal: AbortSignal | undefined
    const { state, scope } = setup((s) => {
      signal = s
      return run.promise
    })

    scope.stop()
    run.resolve('late')
    await flushPromises()

    expect(signal?.aborted).toBe(true)
    expect(state.data.value).toBeUndefined()
  })
})

describe('useAsyncState with watched inputs', () => {
  it('runs again when a watched source changes and keeps only the latest result', async () => {
    const query = ref('pi')
    const runs = new Map<string, ReturnType<typeof deferred<string>>>()
    const { state } = setup(
      () => {
        const run = deferred<string>()
        runs.set(query.value, run)
        return run.promise
      },
      { watch: query },
    )

    query.value = 'pizza'
    await nextTick()
    runs.get('pizza')?.resolve('result for pizza')
    await flushPromises()
    runs.get('pi')?.resolve('result for pi')
    await flushPromises()

    expect(state.data.value).toBe('result for pizza')
  })

  it('accepts several sources', async () => {
    const category = ref('mains')
    const query = ref('')
    const fetcher = vi.fn(() => Promise.resolve('x'))
    setup(fetcher, { watch: [category, query] })
    await flushPromises()

    category.value = 'drinks'
    await nextTick()
    query.value = 'tea'
    await nextTick()

    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { menuApi } from '@/api/menuApi'
import {
  applyConditions,
  getMockConditions,
  resetMockConditions,
  setMockConditions,
} from '@/mocks/conditions'
import { rejection } from '@/test/helpers'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('mock conditions', () => {
  it('defaults to a fast, reliable, online backend', () => {
    resetMockConditions()

    expect(getMockConditions()).toEqual({ latency: 'fast', errorRate: 'off', offline: false })
  })

  it('makes every request fail like a lost connection when offline', async () => {
    setMockConditions({ offline: true })

    const error = await rejection(menuApi.listCategories())

    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })

  it('answers 500 to every request when the error rate is "always"', async () => {
    setMockConditions({ errorRate: 'always' })

    const error = await rejection(menuApi.listCategories())

    expect(error).toMatchObject({ status: 500, code: 'server_error' })
  })

  it('fails about one request in five when the error rate is "sometimes"', async () => {
    setMockConditions({ errorRate: 'sometimes' })
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValue(0.19)
    await expect(menuApi.listCategories()).rejects.toMatchObject({ status: 500 })

    random.mockReturnValue(0.2)
    await expect(menuApi.listCategories()).resolves.toHaveLength(4)
  })

  it('recovers when conditions are switched back', async () => {
    setMockConditions({ offline: true })
    await rejection(menuApi.listCategories())

    setMockConditions({ offline: false })

    await expect(menuApi.listCategories()).resolves.toHaveLength(4)
  })
})

describe('mock latency', () => {
  /** Resolves with how many ms `applyConditions` took, advancing fake time in 1 ms steps. */
  async function elapsed(): Promise<number> {
    vi.useFakeTimers()
    const state = { settled: false }
    void applyConditions().then(() => {
      state.settled = true
    })
    let ms = 0
    while (!state.settled && ms < 20_000) {
      await vi.advanceTimersByTimeAsync(1)
      ms += 1
    }
    return ms
  }

  it('adds no delay by default in tests', async () => {
    expect(await elapsed()).toBeLessThanOrEqual(1)
  })

  it.each([
    ['fast', 300, 700],
    ['slow3g', 1500, 2500],
    ['verySlow', 5000, 8000],
  ] as const)('%s waits between %i and %i ms', async (latency, min, max) => {
    setMockConditions({ latency })
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValue(0)
    expect(await elapsed()).toBe(min)

    vi.useRealTimers()
    random.mockReturnValue(0.999)
    expect(await elapsed()).toBeGreaterThanOrEqual(max - 10)
    expect(await elapsed()).toBeLessThanOrEqual(max)
  })
})

import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/types/api'

// Hooks for simulating a bad network. The Dev tools panel (PR 09) is a UI over these; tests set
// them directly. Handlers read them on every request, so changes apply immediately.

export type LatencyProfile = 'none' | 'fast' | 'slow3g' | 'verySlow'
export type ErrorRate = 'off' | 'sometimes' | 'always'

export interface MockConditions {
  latency: LatencyProfile
  errorRate: ErrorRate
  /** Every request fails as if the device had no connection. */
  offline: boolean
}

const LATENCY_RANGES_MS: Record<LatencyProfile, readonly [min: number, max: number]> = {
  none: [0, 0],
  fast: [300, 700],
  slow3g: [1500, 2500],
  verySlow: [5000, 8000],
}

const ERROR_PROBABILITY: Record<ErrorRate, number> = {
  off: 0,
  sometimes: 0.2,
  always: 1,
}

const DEFAULTS: MockConditions = { latency: 'fast', errorRate: 'off', offline: false }

let conditions: MockConditions = { ...DEFAULTS }

export function getMockConditions(): Readonly<MockConditions> {
  return conditions
}

export function setMockConditions(patch: Partial<MockConditions>): void {
  conditions = { ...conditions, ...patch }
}

export function resetMockConditions(): void {
  conditions = { ...DEFAULTS }
}

/**
 * Runs before every handler. Returns the response that should replace the real one
 * (network error or 500), or null when the request should proceed normally.
 */
export async function applyConditions(): Promise<Response | null> {
  if (conditions.offline) return HttpResponse.error()

  const [min, max] = LATENCY_RANGES_MS[conditions.latency]
  if (max > 0) await delay(min + Math.random() * (max - min))

  if (Math.random() < ERROR_PROBABILITY[conditions.errorRate]) {
    const body: ApiErrorBody = {
      error: { code: 'server_error', message: 'Simulated server error. Please try again.' },
    }
    return HttpResponse.json(body, { status: 500 })
  }
  return null
}

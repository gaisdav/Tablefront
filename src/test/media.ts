import { vi } from 'vitest'

/** A stand-in for `matchMedia(query)` that matches or not, and can be told the window changed. */
export function fakeMediaQuery(query: string, matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  return {
    media: query,
    matches,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    /** What a resize does: change `matches` and tell the listeners. */
    change(next: boolean) {
      this.matches = next
      for (const listener of listeners)
        listener(new MediaQueryListEvent('change', { matches: next }))
    },
  }
}

/** Makes every media query match (a wide window) or not (a phone), for the rest of the test file. */
export function setViewport(wide: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => fakeMediaQuery(query, wide))
}

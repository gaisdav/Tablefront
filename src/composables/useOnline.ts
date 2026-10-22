import { computed, shallowRef } from 'vue'

const browserOnline = shallowRef(navigator.onLine)
/** Set by the Dev tools panel: the same banner and behaviour as a real loss of connection. */
const simulatedOffline = shallowRef(false)

const online = computed(() => browserOnline.value && !simulatedOffline.value)

// Registered once for the life of the page, so any number of components can read the state and
// none of them can take the listeners away from the others by unmounting.
window.addEventListener('online', () => {
  browserOnline.value = true
})
window.addEventListener('offline', () => {
  browserOnline.value = false
})

export function simulateOffline(offline: boolean): void {
  simulatedOffline.value = offline
}

/**
 * Whether the device has a connection, kept up to date from the browser's `online` and `offline`
 * events. `navigator.onLine` only says whether there is a network at all (not that the server can be
 * reached), so it is a hint for a banner, never a reason to skip a request: failed requests still
 * show their own error states.
 */
export function useOnline() {
  return online
}

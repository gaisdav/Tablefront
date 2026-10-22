import { computed, getCurrentScope, onScopeDispose, shallowRef } from 'vue'

const browserOnline = shallowRef(navigator.onLine)
/** Set by the Dev tools panel: the same banner and behaviour as a real loss of connection. */
const simulatedOffline = shallowRef(false)

const online = computed(() => browserOnline.value && !simulatedOffline.value)

function onOnline(): void {
  browserOnline.value = true
}

function onOffline(): void {
  browserOnline.value = false
}

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
  // Read again on use: the value may have changed while no one was listening.
  browserOnline.value = navigator.onLine
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    })
  }
  return online
}

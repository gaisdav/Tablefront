import { onScopeDispose, watch, type Ref } from 'vue'

// Shared by every caller, so a dialog opened over another one does not unlock the page early.
let locks = 0
let overflowBeforeLock = ''

function acquire(): void {
  if (locks === 0) {
    overflowBeforeLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks += 1
}

function release(): void {
  locks -= 1
  if (locks === 0) document.body.style.overflow = overflowBeforeLock
}

/** Stops the page behind a modal from scrolling while `active` is true. */
export function useScrollLock(active: Ref<boolean>): void {
  let held = false

  function sync(shouldHold: boolean): void {
    if (shouldHold === held) return
    held = shouldHold
    if (shouldHold) acquire()
    else release()
  }

  // Side effect on the document, not derived state.
  watch(active, sync, { immediate: true })
  onScopeDispose(() => {
    sync(false)
  })
}

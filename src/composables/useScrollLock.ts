import { onScopeDispose, watch, type Ref } from 'vue'

// The lock is a class on <body> (see base.css) rather than an inline style, so releasing it
// never has to remember and restore a value that other code may have changed meanwhile.
const LOCK_CLASS = 'scroll-locked'

// Shared by every caller, so a dialog opened over another one does not unlock the page early.
let locks = 0

function acquire(): void {
  if (locks === 0) document.body.classList.add(LOCK_CLASS)
  locks += 1
}

function release(): void {
  locks -= 1
  if (locks === 0) document.body.classList.remove(LOCK_CLASS)
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

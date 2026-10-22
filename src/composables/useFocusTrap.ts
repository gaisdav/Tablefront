import { nextTick, onScopeDispose, watch, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].join(',')

function isTabbable(element: HTMLElement): boolean {
  // Negative tabindex means "focusable by script, but not part of the Tab order".
  if (element.tabIndex < 0) return false
  if (element.closest('[hidden], [inert]') !== null) return false
  // display:none and friends. Older browsers and jsdom lack the method; there we trust the selector.
  return !Reflect.has(element, 'checkVisibility') || element.checkVisibility()
}

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable)
}

// Open traps, oldest first. Only the last one answers the keyboard, so Escape closes the
// dialog on top and not the one underneath it.
const openTraps: symbol[] = []

export interface UseFocusTrapOptions {
  /** Where focus lands when the trap activates. Default: the first focusable element. */
  initialFocus?: () => HTMLElement | undefined
  /** Called when Escape is pressed while this is the topmost trap. */
  onEscape?: () => void
}

/**
 * Keyboard containment for a modal while `active` is true:
 * focus moves in when it activates, Tab and Shift+Tab wrap around, Escape calls `onEscape`,
 * and focus returns to whatever had it before when it deactivates.
 *
 * Keys are caught on the document rather than on the container, so the trap still holds when
 * focus has fallen to the page (the focused button was disabled or removed).
 */
export function useFocusTrap(
  active: Ref<boolean>,
  container: Ref<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
) {
  const token = Symbol('focus-trap')
  let previouslyFocused: HTMLElement | null = null

  function trapTab(event: KeyboardEvent, root: HTMLElement): void {
    const focusable = getFocusable(root)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first === undefined || last === undefined) {
      // Nothing to tab to: keep focus on the container itself.
      event.preventDefault()
      return
    }

    const current = document.activeElement
    const outside = !root.contains(current) || current === root
    if (event.shiftKey && (current === first || outside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (current === last || outside)) {
      event.preventDefault()
      first.focus()
    }
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    // Not ours: a dialog opened later is on top, or the user is composing text with an IME.
    if (openTraps[openTraps.length - 1] !== token || event.isComposing) return
    if (event.key === 'Escape') {
      options.onEscape?.()
    } else if (event.key === 'Tab' && container.value !== null) {
      trapTab(event, container.value)
    }
  }

  function deactivate(): void {
    const index = openTraps.indexOf(token)
    if (index === -1) return
    openTraps.splice(index, 1)
    document.removeEventListener('keydown', onDocumentKeydown)
    previouslyFocused?.focus()
    previouslyFocused = null
  }

  // Side effect on the document's focus and listeners, not derived state.
  watch(
    active,
    async (isActive) => {
      if (!isActive) {
        deactivate()
        return
      }
      if (openTraps.includes(token)) return
      openTraps.push(token)
      document.addEventListener('keydown', onDocumentKeydown)
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null

      // Wait for the container to be rendered, and for the trap to still be wanted.
      await nextTick()
      const root = container.value
      if (!active.value || root === null) return
      const target = options.initialFocus?.() ?? getFocusable(root)[0] ?? root
      target.focus()
    },
    { immediate: true },
  )
  onScopeDispose(deactivate)
}

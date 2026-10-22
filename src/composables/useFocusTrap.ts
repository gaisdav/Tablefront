import { nextTick, onScopeDispose, watch, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

export interface UseFocusTrapOptions {
  /** Where focus lands when the trap activates. Default: the first focusable element. */
  initialFocus?: () => HTMLElement | undefined
}

/**
 * Keeps keyboard focus inside `container` while `active` is true:
 * focus moves in when it activates, Tab and Shift+Tab wrap around, and focus returns to
 * whatever had it before when it deactivates. Wire `onKeydown` to the container's keydown.
 */
export function useFocusTrap(
  active: Ref<boolean>,
  container: Ref<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
) {
  let previouslyFocused: HTMLElement | null = null

  function restoreFocus(): void {
    previouslyFocused?.focus()
    previouslyFocused = null
  }

  // Side effect on the document's focus, not derived state.
  watch(
    active,
    async (isActive) => {
      if (!isActive) {
        restoreFocus()
        return
      }
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      // Wait for the container to be rendered.
      await nextTick()
      const root = container.value
      if (root === null) return
      const target = options.initialFocus?.() ?? getFocusable(root)[0] ?? root
      target.focus()
    },
    { immediate: true },
  )
  onScopeDispose(restoreFocus)

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || container.value === null) return
    const focusable = getFocusable(container.value)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first === undefined || last === undefined) {
      // Nothing to tab to: keep focus on the container itself.
      event.preventDefault()
      return
    }

    const current = document.activeElement
    const outside = !container.value.contains(current) || current === container.value
    if (event.shiftKey && (current === first || outside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (current === last || outside)) {
      event.preventDefault()
      first.focus()
    }
  }

  return { onKeydown }
}

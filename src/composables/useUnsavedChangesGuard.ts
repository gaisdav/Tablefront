import { onScopeDispose } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Keeps people from losing work they have not saved. While `isDirty()` is true:
 * - leaving the page through the router asks first (`askToLeave` resolves with the answer);
 * - closing or reloading the tab triggers the browser's own "leave site?" prompt (the browser
 *   decides the wording; it cannot be customised).
 * Call it from the setup of a page component.
 */
export function useUnsavedChangesGuard(
  isDirty: () => boolean,
  askToLeave: () => Promise<boolean>,
): void {
  onBeforeRouteLeave(() => (isDirty() ? askToLeave() : true))

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (isDirty()) event.preventDefault()
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  onScopeDispose(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
}

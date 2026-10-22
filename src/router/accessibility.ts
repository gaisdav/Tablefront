import { nextTick } from 'vue'
import type { Router } from 'vue-router'

const SITE = 'Tablefront'

/**
 * What a full page load gives for free and a single-page app must do by hand, on every navigation:
 * - the tab and history entry get the page's name, and
 * - for a keyboard or screen reader user, focus moves to the new page's heading, so the change is
 *   announced and the next Tab starts from the top of the new content instead of wherever the old
 *   page's focused link used to be.
 *
 * Focus is moved only when the path changes: filtering the menu or opening an order's details
 * changes the query, not the page, and must not take focus away from what the user is doing. The
 * very first navigation is left alone, as a freshly loaded page starts at the top anyway.
 */
export function installRouteAccessibility(router: Router): void {
  router.afterEach((to, from, failure) => {
    if (failure) return
    document.title = to.meta.title === undefined ? SITE : `${to.meta.title} · ${SITE}`

    const firstNavigation = from.matched.length === 0
    if (firstNavigation || to.path === from.path) return
    // After the new page has rendered.
    void nextTick(moveFocusToPage)
  })
}

/** How long to wait for a heading that appears only once the page's data has arrived. */
const HEADING_WAIT_MS = 3000

function focusElement(target: HTMLElement): void {
  // A heading is not focusable by default; -1 allows focus from code but not from Tab.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

/**
 * The page's own heading if it is there. Some pages draw theirs only after loading (an order), so
 * until then the content area takes the focus (the old focus is gone with the old page), and the
 * focus moves on to the heading when it shows up, unless the user has gone elsewhere meanwhile.
 */
function moveFocusToPage(): void {
  const main = document.querySelector<HTMLElement>('main')
  const heading = main?.querySelector<HTMLElement>('h1')
  if (heading) {
    focusElement(heading)
    return
  }
  if (main === null) return
  focusElement(main)

  const watcher = new MutationObserver(() => {
    const late = main.querySelector<HTMLElement>('h1')
    if (late === null) return
    watcher.disconnect()
    clearTimeout(giveUp)
    if (document.activeElement === main) focusElement(late)
  })
  const giveUp = setTimeout(() => {
    watcher.disconnect()
  }, HEADING_WAIT_MS)
  watcher.observe(main, { childList: true, subtree: true })
}

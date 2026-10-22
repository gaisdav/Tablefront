import type { RouterScrollBehavior } from 'vue-router'

export const scrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
  // Back and forward return to where the user was.
  if (savedPosition) return savedPosition
  // Same page, different query (a filter, a selected row): the user is already where they want to
  // be, and jumping to the top would throw away their place in a long list.
  if (to.path === from.path && !to.hash) return false
  // In-page links such as the "Skip to content" link.
  if (to.hash) return { el: to.hash }
  // Any other navigation starts at the top of the new page.
  return { top: 0 }
}

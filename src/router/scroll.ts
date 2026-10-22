import type { RouterScrollBehavior } from 'vue-router'

export const scrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
  // Back and forward return to where the user was.
  if (savedPosition) return savedPosition
  // In-page links such as the "Skip to content" link.
  if (to.hash) return { el: to.hash }
  // Any other navigation starts at the top of the new page.
  return { top: 0 }
}

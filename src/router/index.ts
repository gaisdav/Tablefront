import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import { installRouteAccessibility } from '@/router/accessibility'
import { routes } from '@/router/routes'
import { scrollBehavior } from '@/router/scroll'

// A factory instead of a singleton, so tests can build a router over a memory history.
export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    routes,
    // Vue Router 5 deprecates this option in favour of an experimental plugin. The experimental
    // API is not worth building on yet; this one still works and has a clear migration path.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    scrollBehavior,
  })
  installRouteAccessibility(router)
  return router
}

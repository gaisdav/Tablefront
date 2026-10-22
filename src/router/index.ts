import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import { routes } from '@/router/routes'

// A factory instead of a singleton, so tests can build a router over a memory history.
export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({ history, routes })
}

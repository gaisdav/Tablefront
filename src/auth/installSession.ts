import type { Pinia } from 'pinia'
import type { LocationQueryValue, RouteLocationRaw, Router } from 'vue-router'
import { bindSession } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const LOGIN = 'admin-login'
const AFTER_LOGIN: RouteLocationRaw = { name: 'admin-orders' }

/**
 * A return address from the URL is only followed if it stays on this site: a link such as
 * `/admin/login?redirect=https://evil.example` or `//evil.example` must not turn the login page
 * into an open redirect.
 */
export function safeRedirect(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): RouteLocationRaw {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return AFTER_LOGIN
  }
  if (target.startsWith('/\\') || target.startsWith('/admin/login')) return AFTER_LOGIN
  return target
}

function loginLocation(from: string): RouteLocationRaw {
  return from.startsWith('/admin/login')
    ? { name: LOGIN }
    : { name: LOGIN, query: { redirect: from } }
}

/**
 * Connects the session to the rest of the app, once, at startup:
 * - the shared API client sends the token and, on a 401, ends the session and goes to the login
 *   page, remembering where the user was;
 * - the router sends visitors without a session away from pages that need one, and signed-in
 *   staff away from the login page.
 */
export function installSession(router: Router, pinia: Pinia): void {
  const auth = useAuthStore(pinia)

  bindSession({
    getToken: () => auth.token,
    onUnauthorized: () => {
      auth.logout()
      // Several requests can fail at once; the client only reports a 401 for a token that is still
      // current, so after the first one ends the session the others are not reported at all.
      void router.replace(loginLocation(router.currentRoute.value.fullPath))
    },
  })

  router.beforeEach((to) => {
    if (to.meta.requiresAuth === true && !auth.isAuthenticated) return loginLocation(to.fullPath)
    if (to.name === LOGIN && auth.isAuthenticated) return safeRedirect(to.query.redirect)
    return true
  })
}

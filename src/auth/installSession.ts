import type { Pinia } from 'pinia'
import type { LocationQueryValue, RouteLocationRaw, Router } from 'vue-router'
import { bindSession } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const LOGIN = 'admin-login'
const AFTER_LOGIN: RouteLocationRaw = { name: 'admin-orders' }

/**
 * Where to go after signing in, from the `?redirect=` in the URL. The address is resolved by the
 * router instead of being inspected as a string: only a page of this app counts. Anything else
 * (another site, a made-up path that lands on "not found", the login page itself, anything that
 * does not start with a single slash) falls back to the default, so the login page cannot be turned
 * into a way of sending people elsewhere.
 */
export function safeRedirect(
  router: Router,
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): RouteLocationRaw {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return AFTER_LOGIN
  }
  const resolved = router.resolve(target)
  if (resolved.name === undefined || resolved.name === 'not-found' || resolved.name === LOGIN) {
    return AFTER_LOGIN
  }
  return resolved.fullPath
}

/**
 * Connects the session to the rest of the app, once, at startup:
 * - the shared API client sends the token and, on a 401, ends the session and goes to the login
 *   page, remembering where the user was (or was on their way to, if a navigation is under way);
 * - the router sends visitors without a session away from pages that need one, and signed-in
 *   staff away from the login page.
 */
export function installSession(router: Router, pinia: Pinia): void {
  const auth = useAuthStore(pinia)

  // `currentRoute` is still the old page while a navigation is under way, and a 401 can arrive in
  // that time (from a guard or a page that is loading), so the destination is remembered too.
  let navigatingTo: string | null = null
  router.beforeEach((to) => {
    navigatingTo = to.fullPath
  })
  router.afterEach(() => {
    navigatingTo = null
  })

  function loginLocation(from: string): RouteLocationRaw {
    return router.resolve(from).name === LOGIN
      ? { name: LOGIN }
      : { name: LOGIN, query: { redirect: from } }
  }

  bindSession({
    getToken: () => auth.token,
    onUnauthorized: () => {
      auth.logout()
      // Several requests can fail at once; the client only reports a 401 for a token that is still
      // current, so after the first one ends the session the others are not reported at all.
      void router.replace(loginLocation(navigatingTo ?? router.currentRoute.value.fullPath))
    },
  })

  router.beforeEach((to) => {
    if (to.meta.requiresAuth === true && !auth.isAuthenticated) return loginLocation(to.fullPath)
    if (to.name === LOGIN && auth.isAuthenticated) return safeRedirect(router, to.query.redirect)
    return true
  })
}

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, type Router } from 'vue-router'
import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { useCartStore } from '@/stores/cart'

const mounted: VueWrapper[] = []

/** Mounts the whole app, with a fresh router and store, at `path`. Call `unmountApps` afterwards. */
export async function mountAppAt(path = '/') {
  const router: Router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()
  const pinia = createPinia()
  const wrapper = mount(App, { global: { plugins: [router, pinia] }, attachTo: document.body })
  mounted.push(wrapper)
  return { wrapper, router, cart: useCartStore(pinia) }
}

export function unmountApps(): void {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
}

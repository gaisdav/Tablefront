import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'
import { createAppRouter } from '@/router'
import '@/styles/index.css'

// Both operands are replaced at build time, so in a real production build this is `false` and
// the dynamic import below (the whole mock API) is removed from the bundle.
const useMocks = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true'

async function bootstrap(): Promise<void> {
  if (useMocks) {
    try {
      const { worker } = await import('@/mocks/browser')
      // Wait for the worker, or the first requests would reach the real network.
      await worker.start({
        onUnhandledFrame: 'bypass',
        serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      })
    } catch (error) {
      // No service worker (unsupported browser, blocked by settings, a missing or mismatched
      // worker file): mount anyway, so the app shows its error states instead of a blank page,
      // but say why, or every request would just look like a mysterious failure.
      // eslint-disable-next-line no-console -- the one diagnostic for a broken dev/demo setup
      console.warn('The mock API could not start; requests will reach the real network.', error)
    }
  }
  createApp(App).use(createPinia()).use(createAppRouter()).mount('#app')
}

void bootstrap()

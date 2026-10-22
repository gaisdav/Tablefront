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
    } catch {
      // No service worker (unsupported browser, blocked by settings): mount anyway. Every
      // request then fails and the app shows its error states instead of a blank page.
    }
  }
  createApp(App).use(createAppRouter()).mount('#app')
}

void bootstrap()

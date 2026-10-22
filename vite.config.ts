import { rmSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// `public/` is copied into every build, but the mock service worker is only wanted when the mock
// API is (`VITE_ENABLE_MOCKS=true`). Without this, a real production deploy would still serve a
// worker that anything on the same origin could register.
function removeMockWorkerUnlessEnabled(mocksEnabled: boolean): Plugin {
  return {
    name: 'remove-mock-worker-unless-enabled',
    apply: 'build',
    closeBundle() {
      if (!mocksEnabled)
        rmSync(new URL('./dist/mockServiceWorker.js', import.meta.url), { force: true })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), removeMockWorkerUnlessEnabled(env.VITE_ENABLE_MOCKS === 'true')],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})

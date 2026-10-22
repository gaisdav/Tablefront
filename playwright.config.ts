import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const inCi = Boolean(process.env.CI)

// The tests run against the production build of the demo (the mock API on), the way it is
// deployed, not against the dev server.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: inCi,
  // A flaky test is a bug to fix, not to retry.
  retries: 0,
  workers: inCi ? 2 : undefined,
  reporter: inCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // Kept only for failures: a trace to replay, a screenshot of the last state.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The service worker that serves the mock API must be allowed, and each test starts with an
    // empty browser (no saved cart, orders or session).
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    env: { VITE_ENABLE_MOCKS: 'true' },
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !inCi,
    timeout: 120_000,
  },
})

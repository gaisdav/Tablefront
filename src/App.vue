<script setup lang="ts">
import { defineAsyncComponent, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import OfflineBanner from '@/components/OfflineBanner.vue'

// Only in builds that have the mock API (the same condition as in `main.ts`, written out here
// because the bundler only removes the dead branch when it can see both operands replaced in this
// very file). Elsewhere the panel, which controls the mock API, is not in the bundle at all.
const useMocks = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true'
const DevTools = useMocks
  ? defineAsyncComponent({
      loader: () => import('@/devtools/DevToolsHost.vue'),
      // A chunk that cannot be fetched (a stale deploy, a dropped connection) just means no panel.
      errorComponent: { render: () => null },
    })
  : null

if (useMocks) {
  // Known before the first paint, so the room the panel's button needs is there from the start and
  // nothing moves when the (lazy) panel arrives. See `--reserved-bottom` in base.css.
  document.documentElement.classList.add('has-devtools')
  onUnmounted(() => {
    document.documentElement.classList.remove('has-devtools')
  })
}
</script>

<template>
  <OfflineBanner />
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
  <component :is="DevTools" v-if="DevTools !== null" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { RouterView } from 'vue-router'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import OfflineBanner from '@/components/OfflineBanner.vue'

// Only in builds that have the mock API (the same condition as in `main.ts`, written out here
// because the bundler only removes the dead branch when it can see both operands replaced in this
// very file). Elsewhere the panel, which controls the mock API, is not in the bundle at all.
const useMocks = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'true'
const DevTools = useMocks ? defineAsyncComponent(() => import('@/devtools/DevToolsHost.vue')) : null
</script>

<template>
  <OfflineBanner />
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
  <component :is="DevTools" v-if="DevTools !== null" />
</template>

<script setup lang="ts">
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const failed = shallowRef(false)

// A render error in a page, a layout or an event handler below ends up here. Showing a fallback
// instead of a blank screen keeps the app usable; the error itself is still reported.
onErrorCaptured((error) => {
  failed.value = true
  // eslint-disable-next-line no-console -- the one place an unexpected failure is reported
  console.error('Unexpected error while rendering:', error)
  return false
})

// Going somewhere else is a fresh start.
watch(
  () => route.fullPath,
  () => {
    failed.value = false
  },
)

function retry(): void {
  failed.value = false
}

function goToMenu(): void {
  failed.value = false
  void router.push({ name: 'menu' })
}
</script>

<template>
  <main v-if="failed" class="fallback" tabindex="-1">
    <div class="fallback__card" role="alert">
      <h1 class="fallback__title">Something went wrong</h1>
      <p class="text-muted">
        The page hit an unexpected problem. Your cart is safe. Try again, or go back to the menu.
      </p>
      <div class="fallback__actions">
        <BaseButton @click="retry">Try again</BaseButton>
        <BaseButton variant="secondary" @click="goToMenu">Back to the menu</BaseButton>
      </div>
    </div>
  </main>
  <slot v-else />
</template>

<style scoped>
.fallback {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  padding: var(--gutter);
}

.fallback__card {
  display: grid;
  gap: var(--space-3);
  max-width: 26rem;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.fallback__title {
  font-size: var(--text-xl);
}

.fallback__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>

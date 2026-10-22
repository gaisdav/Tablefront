<script setup lang="ts">
import { nextTick, onErrorCaptured, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const failed = shallowRef(false)
const heading = useTemplateRef<HTMLElement>('heading')

/**
 * Only a failure to show the page replaces it. An error in an event handler or a watcher is one
 * action that went wrong, not a page that cannot be drawn: it is reported and the page stays as
 * it is, with whatever the user had typed.
 */
function isActionError(info: string): boolean {
  return info.includes('event handler') || info.includes('watcher')
}

onErrorCaptured((error, _instance, info) => {
  // eslint-disable-next-line no-console -- the one place an unexpected failure is reported
  console.error('Unexpected error:', error)
  if (!isActionError(info)) failed.value = true
  return false
})

// Going somewhere else is a fresh start.
watch(
  () => route.fullPath,
  () => {
    failed.value = false
  },
)

// The fallback takes the place of the page, so it gets the focus the way a new page does (and so
// again when "Try again" fails again).
watch(failed, (isFailed) => {
  if (isFailed) void nextTick(() => heading.value?.focus())
})

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
      <h1 ref="heading" class="fallback__title" tabindex="-1">Something went wrong</h1>
      <p class="text-muted">
        The page hit an unexpected problem. Your cart is kept on this device. Try again, or go back
        to the menu.
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
  min-height: calc(100vh - var(--reserved-bottom, 0px));
  min-height: calc(100dvh - var(--reserved-bottom, 0px));
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

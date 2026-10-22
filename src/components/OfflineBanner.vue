<script setup lang="ts">
import { useOnline } from '@/composables/useOnline'

const online = useOnline()
</script>

<template>
  <!-- The region is always in the page and only its content comes and goes, so the change is announced. -->
  <div class="banner-host" role="status">
    <p v-if="!online" class="banner">
      You are offline. Changes cannot be saved and what you see may be out of date.
    </p>
  </div>
</template>

<style scoped>
/* Floats over the page instead of pushing it down: nothing moves when the connection drops. It
   sits above the space the Dev tools button reserves, and under dialogs and toasts. */
.banner-host {
  position: fixed;
  right: var(--space-4);
  bottom: calc(var(--space-4) + var(--reserved-bottom, 0px));
  left: var(--space-4);
  z-index: 45;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.banner {
  max-width: 32rem;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  box-shadow: var(--shadow-md);
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: center;
}
</style>

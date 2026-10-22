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
.banner {
  padding: var(--space-2) var(--gutter);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: center;
}
</style>

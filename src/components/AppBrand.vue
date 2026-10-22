<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <RouterLink to="/" class="brand">
    <span class="brand__mark" aria-hidden="true">T</span>
    <span class="brand__name">Tablefront</span>
    <slot />
  </RouterLink>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  text-decoration: none;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--text-base);
}
</style>

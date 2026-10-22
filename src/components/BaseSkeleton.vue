<script setup lang="ts">
const {
  variant = 'text',
  width,
  height,
} = defineProps<{
  variant?: 'text' | 'block' | 'circle'
  /** Any CSS length; text and block fill the available width by default. */
  width?: string
  height?: string
}>()
// Decorative: the loading state is announced by the surrounding region, not by the shapes.
</script>

<template>
  <span
    class="skeleton"
    :class="`skeleton--${variant}`"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-surface-sunken) 25%,
    var(--color-border) 50%,
    var(--color-surface-sunken) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton--text {
  height: 1em;
  border-radius: var(--radius-sm);
}

.skeleton--block {
  height: 6rem;
  border-radius: var(--radius-md);
}

.skeleton--circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>

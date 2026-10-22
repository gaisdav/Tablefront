<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="state">
    <svg
      class="state__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke-width="1.8" stroke-dasharray="3 3" />
      <path d="M8.5 12h7" stroke-width="2" stroke-linecap="round" />
    </svg>
    <p class="state__title">{{ title }}</p>
    <p v-if="description" class="state__description">{{ description }}</p>
    <div v-if="$slots.action" class="state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-7) var(--space-4);
  text-align: center;
}

.state__icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
}

.state__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.state__description {
  max-width: 28rem;
  color: var(--color-text-muted);
}

.state__action {
  margin-top: var(--space-3);
}
</style>

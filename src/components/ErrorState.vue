<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'

const { title = 'Something went wrong', retryLabel = 'Try again' } = defineProps<{
  title?: string
  message: string
  retryLabel?: string
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <!-- role="alert" makes screen readers announce the failure the moment it appears. -->
  <div class="state" role="alert">
    <svg
      class="state__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3 2.5 20h19L12 3Z" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M12 10v4.5M12 17.5v.01" stroke-width="2" stroke-linecap="round" />
    </svg>
    <p class="state__title">{{ title }}</p>
    <p class="state__message">{{ message }}</p>
    <BaseButton variant="secondary" @click="$emit('retry')">{{ retryLabel }}</BaseButton>
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
  color: var(--color-danger);
}

.state__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.state__message {
  max-width: 28rem;
  margin-bottom: var(--space-3);
  color: var(--color-text-muted);
}
</style>

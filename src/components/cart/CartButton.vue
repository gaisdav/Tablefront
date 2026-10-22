<script setup lang="ts">
import { computed } from 'vue'

const { count, hasNotices } = defineProps<{
  count: number
  /** The cart changed without the user doing it; they should open it and look. */
  hasNotices?: boolean
}>()

defineEmits<{ click: [] }>()

const label = computed(() => {
  const items = count === 0 ? 'empty' : `${String(count)} ${count === 1 ? 'item' : 'items'}`
  return hasNotices ? `Cart, ${items}, has changes` : `Cart, ${items}`
})
</script>

<template>
  <button
    class="cart-button"
    type="button"
    aria-haspopup="dialog"
    :aria-label="label"
    @click="$emit('click')"
  >
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M5 8h14l-1 12H6L5 8Z" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <span v-if="count > 0" class="cart-button__count" aria-hidden="true">{{ count }}</span>
    <span v-if="hasNotices" class="cart-button__alert" aria-hidden="true" />
  </button>
</template>

<style scoped>
.cart-button {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.cart-button:hover {
  background: var(--color-surface-sunken);
}

.cart-button__count {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 1.25rem;
  height: 1.25rem;
  padding-inline: 0.3rem;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  line-height: 1.25rem;
  text-align: center;
}

.cart-button__alert {
  position: absolute;
  bottom: 6px;
  left: 6px;
  width: 0.6rem;
  height: 0.6rem;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  background: var(--color-danger);
}
</style>

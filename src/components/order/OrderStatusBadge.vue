<script setup lang="ts">
import { statusLabel } from '@/domain/orderStatus'
import type { OrderStatus } from '@/types/domain'

defineProps<{ status: OrderStatus }>()
</script>

<template>
  <!-- The word carries the meaning; the colour of the dot only reinforces it. -->
  <span class="badge" :class="`badge--${status}`">
    <span class="badge__dot" aria-hidden="true" />
    {{ statusLabel(status) }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.125rem var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-surface-sunken);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.badge__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
}

.badge--new .badge__dot,
.badge--preparing .badge__dot {
  background: var(--color-accent);
}

.badge--ready .badge__dot,
.badge--completed .badge__dot {
  background: var(--color-success);
}

.badge--cancelled {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.badge--cancelled .badge__dot {
  background: var(--color-danger);
}
</style>

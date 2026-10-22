<script setup lang="ts">
import { useToastsStore } from '@/stores/toasts'

const toasts = useToastsStore()
</script>

<template>
  <!-- The region stays in the page, empty, so that what is added to it is announced; an error is an
       alert (it interrupts), the rest wait their turn. -->
  <div class="host" role="region" aria-label="Notifications">
    <div class="host__live" aria-live="polite">
      <div
        v-for="toast in toasts.toasts.filter((t) => t.kind === 'info')"
        :key="toast.id"
        class="toast"
      >
        <p class="toast__message">{{ toast.message }}</p>
        <button
          class="toast__close"
          type="button"
          aria-label="Dismiss"
          @click="toasts.dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </div>
    <div
      v-for="toast in toasts.toasts.filter((t) => t.kind === 'error')"
      :key="toast.id"
      class="toast toast--error"
      role="alert"
    >
      <p class="toast__message">{{ toast.message }}</p>
      <button
        class="toast__close"
        type="button"
        aria-label="Dismiss"
        @click="toasts.dismiss(toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.host {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  left: var(--space-4);
  z-index: 50;
  display: grid;
  gap: var(--space-2);
  justify-items: end;
  pointer-events: none;
}

.host__live {
  display: contents;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: min(26rem, 100%);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.toast--error {
  border-color: var(--color-danger);
}

.toast__message {
  flex: 1;
  overflow-wrap: anywhere;
}

.toast--error .toast__message {
  color: var(--color-danger);
}

.toast__close {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  margin: calc(var(--space-3) * -1) calc(var(--space-4) * -1) calc(var(--space-3) * -1) 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-xl);
  cursor: pointer;
}

@media (min-width: 48rem) {
  .host {
    left: auto;
  }
}
</style>

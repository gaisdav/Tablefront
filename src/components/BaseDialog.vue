<script setup lang="ts">
import { ref, useId } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import { getFocusable, useFocusTrap } from '@/composables/useFocusTrap'
import { useScrollLock } from '@/composables/useScrollLock'

const open = defineModel<boolean>('open', { required: true })
const { title } = defineProps<{ title: string }>()

defineSlots<{
  default(): unknown
  /** Action buttons. Rendered below the content. */
  footer?(): unknown
}>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

// Focus starts on the first control in the content (a form field, a Cancel button) rather than
// on the close button that comes first in the DOM.
const { onKeydown: trapTab } = useFocusTrap(open, panel, {
  initialFocus: () => (content.value === null ? undefined : getFocusable(content.value)[0]),
})
useScrollLock(open)

function close(): void {
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    // Only the dialog that has focus closes, even if another one is open underneath.
    event.stopPropagation()
    close()
    return
  }
  trapTab(event)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <!-- mousedown, not click: dragging a text selection out of a field must not dismiss it. -->
      <div v-if="open" class="backdrop" @mousedown.self="close">
        <div
          ref="panel"
          class="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <header class="panel__header">
            <h2 :id="titleId" class="panel__title">{{ title }}</h2>
            <BaseButton
              variant="ghost"
              class="panel__close"
              aria-label="Close dialog"
              @click="close"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" stroke-width="2" stroke-linecap="round" />
              </svg>
            </BaseButton>
          </header>
          <div ref="content" class="panel__content">
            <div class="panel__body"><slot /></div>
            <footer v-if="$slots.footer" class="panel__footer"><slot name="footer" /></footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Phone: a sheet that slides up from the bottom. Tablet and up: a centred card. */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 50%);
}

.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 92vh;
  max-height: 92dvh;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.panel:focus-visible {
  outline: none;
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.panel__title {
  font-size: var(--text-lg);
}

.panel__close {
  padding-inline: var(--space-3);
}

.panel__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel__body {
  padding: var(--space-5);
  overflow-y: auto;
}

.panel__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
}

@media (min-width: 48rem) {
  .backdrop {
    align-items: center;
  }

  .panel {
    width: min(32rem, calc(100% - 2 * var(--gutter)));
    border-radius: var(--radius-lg);
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.dialog-enter-active .panel,
.dialog-leave-active .panel {
  transition: transform var(--duration-base) var(--ease-out);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .panel,
.dialog-leave-to .panel {
  transform: translateY(2rem);
}
</style>

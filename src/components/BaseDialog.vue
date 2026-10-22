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

function close(): void {
  open.value = false
}

// Focus starts on the first control in the content (a form field, a Cancel button) rather than
// on the close button that comes first in the DOM.
useFocusTrap(open, panel, {
  initialFocus: () => (content.value === null ? undefined : getFocusable(content.value)[0]),
  onEscape: close,
})
useScrollLock(open)

// A press only dismisses the dialog if it both starts and ends on the backdrop. Dragging a text
// selection out of a field, or a press that begins on the backdrop and ends in the panel, must not.
let pressStartedOnBackdrop = false

function onBackdropMousedown(event: MouseEvent): void {
  pressStartedOnBackdrop = event.target === event.currentTarget
}

function onBackdropMouseup(event: MouseEvent): void {
  const completed = pressStartedOnBackdrop && event.target === event.currentTarget
  pressStartedOnBackdrop = false
  if (completed) close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="open"
        class="backdrop"
        @mousedown="onBackdropMousedown"
        @mouseup="onBackdropMouseup"
      >
        <div
          ref="panel"
          class="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
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

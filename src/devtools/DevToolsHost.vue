<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCheckbox from '@/components/BaseCheckbox.vue'
import { simulateOffline } from '@/composables/useOnline'
import { reloadPage } from '@/devtools/reload'
import {
  getMockConditions,
  resetMockConditions,
  setMockConditions,
  type ErrorRate,
  type LatencyProfile,
} from '@/mocks/conditions'
import { resetDb } from '@/mocks/db'

const LATENCIES: readonly { value: LatencyProfile; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fast', label: 'Fast' },
  { value: 'slow3g', label: 'Slow 3G' },
  { value: 'verySlow', label: 'Very slow' },
]

const ERROR_RATES: readonly { value: ErrorRate; label: string }[] = [
  { value: 'off', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'always', label: 'Always' },
]

const open = ref(false)
const panelId = useId()
const root = ref<HTMLElement | null>(null)
const conditions = reactive({ ...getMockConditions() })

// The handlers read the conditions on every request, so a change applies to the next one.
watch(conditions, () => {
  setMockConditions({ ...conditions })
  simulateOffline(conditions.offline)
})

function resetConditions(): void {
  resetMockConditions()
  Object.assign(conditions, getMockConditions())
}

// Orders and menu edits are kept across reloads; this is the way back to the fixtures. The page
// reloads because everything on screen (and in the stores) was built from the old data.
// It destroys the demo's orders and menu edits, so it asks first, on the button itself.
const confirmingReset = ref(false)

function resetData(): void {
  if (!confirmingReset.value) {
    confirmingReset.value = true
    return
  }
  resetDb()
  reloadPage()
}

function toggle(): void {
  if (open.value) close()
  else open.value = true
}

function onEscape(event: KeyboardEvent): void {
  // Only for an open panel; otherwise Escape belongs to whatever else is on the page.
  if (!open.value) return
  event.stopPropagation()
  close()
}

function close(): void {
  open.value = false
  confirmingReset.value = false
  root.value?.querySelector<HTMLElement>('.toggle')?.focus()
}
</script>

<template>
  <div ref="root" class="devtools" @keydown.esc="onEscape">
    <section v-if="open" :id="panelId" class="panel" aria-labelledby="devtools-title">
      <h2 id="devtools-title" class="panel__title">Dev tools</h2>
      <p class="text-muted panel__hint">
        Simulate a bad network for the mock API; applies from the next request. Fast is 0.3–0.7 s,
        Slow 3G 1.5–2.5 s, Very slow 5–8 s. Sometimes fails one request in five.
      </p>

      <fieldset class="group">
        <legend>Latency</legend>
        <label v-for="option in LATENCIES" :key="option.value" class="radio">
          <input v-model="conditions.latency" type="radio" name="latency" :value="option.value" />
          {{ option.label }}
        </label>
      </fieldset>

      <fieldset class="group">
        <legend>Server errors</legend>
        <label v-for="option in ERROR_RATES" :key="option.value" class="radio">
          <input v-model="conditions.errorRate" type="radio" name="errors" :value="option.value" />
          {{ option.label }}
        </label>
      </fieldset>

      <BaseCheckbox v-model="conditions.offline" label="Offline (every request fails)" />

      <div class="panel__actions">
        <BaseButton variant="secondary" @click="resetConditions">Reset network</BaseButton>
        <BaseButton variant="danger" @click="resetData" @blur="confirmingReset = false">
          {{ confirmingReset ? 'Sure? Click again' : 'Reset demo data' }}
        </BaseButton>
      </div>
    </section>

    <BaseButton
      class="toggle"
      variant="secondary"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      @click="toggle"
    >
      Dev tools
    </BaseButton>
  </div>
</template>

<style scoped>
.devtools {
  position: fixed;
  bottom: var(--space-3);
  left: var(--space-3);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  max-width: calc(100vw - 2 * var(--space-3));
}

.toggle {
  box-shadow: var(--shadow-md);
}

.panel {
  display: grid;
  gap: var(--space-2);
  width: 21rem;
  max-width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  padding: var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.panel__title {
  font-size: var(--text-lg);
}

.panel__hint {
  font-size: var(--text-sm);
}

.panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  padding: 0;
  border: 0;
}

.group legend {
  grid-column: 1 / -1;
  padding: 0;
  font-weight: var(--weight-semibold);
}

.radio {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  cursor: pointer;
}

.radio input {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  accent-color: var(--color-accent);
}
</style>

<script setup lang="ts">
// Not a `v-model`: a switch like this one is only *asked* to change (its owner may refuse, or take a
// moment to save), so it reports the wish with `toggle` and shows whatever `checked` says.
const { checked } = defineProps<{
  checked: boolean
  /** What the switch controls, for assistive technology: "Margherita pizza available". */
  label: string
  /** A change is being saved. The switch stays focusable and says it is busy. */
  busy?: boolean
}>()

const emit = defineEmits<{ toggle: [next: boolean] }>()

function toggle(): void {
  emit('toggle', !checked)
}
</script>

<template>
  <button
    class="switch"
    type="button"
    role="switch"
    :aria-checked="checked"
    :aria-label="label"
    :aria-busy="busy || undefined"
    @click="toggle"
  >
    <span class="switch__track" aria-hidden="true">
      <span class="switch__thumb" />
    </span>
  </button>
</template>

<style scoped>
/* The button is a full tap target; the drawn switch inside it is smaller. */
.switch {
  display: inline-grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.switch__track {
  display: flex;
  align-items: center;
  width: 2.5rem;
  height: 1.5rem;
  padding: 2px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.switch[aria-checked='true'] .switch__track {
  background: var(--color-success);
}

.switch__thumb {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  background: #fff;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-out);
}

.switch[aria-checked='true'] .switch__thumb {
  transform: translateX(1rem);
}

.switch[aria-busy='true'] .switch__track {
  opacity: 0.6;
}

.switch:focus-visible .switch__track {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
</style>

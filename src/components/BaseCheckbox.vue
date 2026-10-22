<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string }>()
</script>

<template>
  <!-- The whole label is the target: at least a finger tall, and a click on the text toggles it. -->
  <label class="check">
    <input v-model="model" class="check__input" type="checkbox" />
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  cursor: pointer;
}

.check__input {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  accent-color: var(--color-accent);
}
</style>

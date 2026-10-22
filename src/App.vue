<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <main>
    <h1>{{ title ?? 'Tablefront' }}</h1>
    <p>Restaurant online ordering demo.</p>
  </main>
</template>

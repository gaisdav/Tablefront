<script setup lang="ts">
import { computed } from 'vue'
import ChipGroup, { type ChipOption } from '@/components/ChipGroup.vue'
import type { Category } from '@/types/domain'

/** The selected category id, or undefined for "All". */
const selected = defineModel<string | undefined>({ required: true })
const { categories } = defineProps<{ categories: Category[] }>()

const options = computed<ChipOption<string | undefined>[]>(() => [
  { value: undefined, label: 'All' },
  ...categories.map((category) => ({ value: category.id, label: category.name })),
])
</script>

<template>
  <ChipGroup v-model="selected" legend="Filter by category" :options="options" />
</template>

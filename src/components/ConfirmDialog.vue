<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import type { ConfirmRequest } from '@/composables/useConfirm'

const { request } = defineProps<{ request: ConfirmRequest | null }>()
const emit = defineEmits<{ answer: [yes: boolean] }>()

// Closing it any other way (Escape, the backdrop, the close button) is a "no".
const open = computed({
  get: () => request !== null,
  set: (value) => {
    if (!value) emit('answer', false)
  },
})
</script>

<template>
  <BaseDialog v-model:open="open" :title="request?.title ?? ''">
    <p>{{ request?.message }}</p>
    <template #footer>
      <!-- Cancel comes first: it is where focus starts, so Enter cannot confirm by accident. -->
      <BaseButton variant="secondary" @click="emit('answer', false)">Cancel</BaseButton>
      <BaseButton
        :variant="request?.destructive ? 'danger' : 'primary'"
        @click="emit('answer', true)"
      >
        {{ request?.confirmLabel }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

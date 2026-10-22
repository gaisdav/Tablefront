<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import QuantityStepper from '@/components/cart/QuantityStepper.vue'
import { lineTotalCents, MAX_NOTE_LENGTH } from '@/domain/cart'
import { formatCents } from '@/domain/money'
import type { CartLine } from '@/types/cart'

defineProps<{ line: CartLine }>()

defineEmits<{
  'update:quantity': [quantity: number]
  'update:note': [note: string]
  remove: []
}>()
</script>

<template>
  <article class="line">
    <div class="line__head">
      <h3 class="line__name">{{ line.name }}</h3>
      <p class="line__total">{{ formatCents(lineTotalCents(line)) }}</p>
    </div>
    <p class="line__unit text-muted">{{ formatCents(line.unitPriceCents) }} each</p>

    <div class="line__controls">
      <QuantityStepper
        :model-value="line.quantity"
        :label="line.name"
        @update:model-value="$emit('update:quantity', $event)"
      />
      <BaseButton
        variant="ghost"
        :aria-label="`Remove ${line.name} from cart`"
        @click="$emit('remove')"
      >
        Remove
      </BaseButton>
    </div>

    <BaseInput
      :model-value="line.note"
      label="Note"
      :aria-label="`Note for ${line.name}`"
      placeholder="e.g. no onions"
      autocomplete="off"
      :maxlength="MAX_NOTE_LENGTH"
      @update:model-value="$emit('update:note', $event)"
    />
  </article>
</template>

<style scoped>
.line {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
}

.line__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.line__name {
  font-size: var(--text-base);
}

.line__total {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.line__unit {
  font-size: var(--text-sm);
}

.line__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
</style>

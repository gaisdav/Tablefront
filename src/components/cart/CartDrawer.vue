<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import CartLineItem from '@/components/cart/CartLineItem.vue'
import EmptyState from '@/components/EmptyState.vue'
import { describeNotice } from '@/domain/cart'
import { formatCents } from '@/domain/money'
import type { CartLine, CartNotice } from '@/types/cart'

const open = defineModel<boolean>('open', { required: true })

defineProps<{
  lines: CartLine[]
  subtotalCents: number
  /** Things that changed in the cart without the user doing it. */
  notices: CartNotice[]
  /** The check against the current menu failed, so prices are unconfirmed. */
  priceCheckFailed?: boolean
}>()

const emit = defineEmits<{
  updateQuantity: [menuItemId: string, quantity: number]
  updateNote: [menuItemId: string, note: string]
  remove: [menuItemId: string]
  dismissNotice: [id: number]
  checkout: []
  browse: []
}>()
</script>

<template>
  <BaseDialog v-model:open="open" title="Your order" placement="side">
    <ul v-if="notices.length > 0" class="notices" role="list" aria-label="Changes to your cart">
      <li v-for="notice in notices" :key="notice.id" class="notice">
        <span>{{ describeNotice(notice) }}</span>
        <BaseButton
          variant="ghost"
          :aria-label="`Dismiss: ${describeNotice(notice)}`"
          @click="emit('dismissNotice', notice.id)"
        >
          Dismiss
        </BaseButton>
      </li>
    </ul>

    <p v-if="priceCheckFailed && lines.length > 0" class="text-muted check-failed">
      The latest prices could not be checked. They are confirmed when you place the order.
    </p>

    <EmptyState
      v-if="lines.length === 0"
      title="Your cart is empty"
      description="Add something tasty from the menu."
    >
      <template #action>
        <BaseButton @click="emit('browse')">Browse the menu</BaseButton>
      </template>
    </EmptyState>

    <ul v-else class="lines" role="list">
      <li v-for="line in lines" :key="line.menuItemId">
        <CartLineItem
          :line="line"
          @update:quantity="emit('updateQuantity', line.menuItemId, $event)"
          @update:note="emit('updateNote', line.menuItemId, $event)"
          @remove="emit('remove', line.menuItemId)"
        />
      </li>
    </ul>

    <template v-if="lines.length > 0" #footer>
      <div class="summary">
        <p class="summary__total">
          <span>Total</span>
          <strong>{{ formatCents(subtotalCents) }}</strong>
        </p>
        <BaseButton block @click="emit('checkout')">Go to checkout</BaseButton>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.notices,
.lines {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notices {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  font-size: var(--text-sm);
}

.check-failed {
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
}

.summary {
  display: grid;
  gap: var(--space-3);
  width: 100%;
}

.summary__total {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-lg);
}
</style>

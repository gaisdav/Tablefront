<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import OrderTracking from '@/components/order/OrderTracking.vue'
import { useMyOrdersStore } from '@/stores/myOrders'

const route = useRoute()
const myOrders = useMyOrdersStore()
const orderId = computed(() => {
  const { id } = route.params
  return (Array.isArray(id) ? id[0] : id) ?? ''
})
</script>

<template>
  <div>
    <!-- Not for someone who followed a shared link: they have no orders of their own to go back to. -->
    <RouterLink v-if="!myOrders.isEmpty" class="back" :to="{ name: 'orders' }">
      ← My orders
    </RouterLink>
    <!-- Keyed by id: opening another order starts a fresh poller instead of reusing the old one. -->
    <OrderTracking :key="orderId" :order-id="orderId" />
  </div>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-size);
  margin-bottom: var(--space-2);
  font-weight: var(--weight-medium);
}
</style>

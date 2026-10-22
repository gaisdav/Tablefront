<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import OrderTracking from '@/components/order/OrderTracking.vue'

const route = useRoute()
const orderId = computed(() => {
  const { id } = route.params
  return (Array.isArray(id) ? id[0] : id) ?? ''
})
</script>

<template>
  <RouterLink class="back" :to="{ name: 'orders' }">← My orders</RouterLink>
  <!-- Keyed by id: opening another order starts a fresh poller instead of reusing the old one. -->
  <OrderTracking :key="orderId" :order-id="orderId" />
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

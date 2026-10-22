<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OrderTracking from '@/components/order/OrderTracking.vue'

const route = useRoute()
const orderId = computed(() => {
  const { id } = route.params
  return (Array.isArray(id) ? id[0] : id) ?? ''
})
</script>

<template>
  <!-- Keyed by id: opening another order starts a fresh poller instead of reusing the old one. -->
  <OrderTracking :key="orderId" :order-id="orderId" />
</template>

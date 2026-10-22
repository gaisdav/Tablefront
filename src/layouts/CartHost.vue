<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { menuApi } from '@/api/menuApi'
import CartButton from '@/components/cart/CartButton.vue'
import CartDrawer from '@/components/cart/CartDrawer.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { describeCartChange, describeNotice } from '@/domain/cart'
import { useCartStore } from '@/stores/cart'

// The smart side of the cart: it knows the store, the router and the API. The button and the
// drawer it renders only take props and emit events.
const cart = useCartStore()
const router = useRouter()
const open = ref(false)
const announcement = ref('')

// Compares the cart with what is on the menu now (a dish may have sold out, a price may have
// changed since it was saved). Results land in `cart.notices`.
const priceCheck = useAsyncState(
  async (signal) => {
    cart.reconcile(await menuApi.listMenuItems({}, signal))
  },
  { immediate: false },
)

onMounted(() => {
  if (!cart.isEmpty) void priceCheck.execute()
})

// Opening the cart is the moment the prices matter, so check again.
watch(open, (isOpen) => {
  if (isOpen && !cart.isEmpty) void priceCheck.execute()
})

// Side effect: say what happened to the cart, for people who cannot see it. One watcher, not two:
// a change the user did not make (a dish sold out) shows up both as a removed line and as a
// notice, and the notice is the explanation worth hearing, so it must win deterministically.
// While the drawer is open its own controls announce what the user does, so this stays quiet then.
watch(
  () => [cart.lines.map((line) => ({ ...line })), cart.notices.length] as const,
  ([after, noticeCount], [before, previousNoticeCount]) => {
    if (noticeCount > previousNoticeCount) {
      announcement.value = `Your cart changed. ${cart.notices.slice(previousNoticeCount).map(describeNotice).join(' ')}`
      return
    }
    if (open.value) return
    const message = describeCartChange(before, after)
    if (message !== null) announcement.value = message
  },
  { deep: true },
)

function goTo(name: 'checkout' | 'menu'): void {
  open.value = false
  void router.push({ name })
}
</script>

<template>
  <CartButton :count="cart.itemCount" :has-notices="cart.notices.length > 0" @click="open = true" />

  <CartDrawer
    v-model:open="open"
    :lines="cart.lines"
    :subtotal-cents="cart.subtotalCents"
    :notices="cart.notices"
    :price-check-failed="priceCheck.error.value !== null"
    @update-quantity="cart.setQuantity"
    @update-note="cart.setNote"
    @remove="cart.remove"
    @dismiss-notice="cart.dismissNotice"
    @checkout="goTo('checkout')"
    @browse="goTo('menu')"
  />

  <p class="visually-hidden" role="status">{{ announcement }}</p>
</template>

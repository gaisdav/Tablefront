<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import { isNavigationFailure, useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { ordersApi } from '@/api/ordersApi'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import EmptyState from '@/components/EmptyState.vue'
import FulfillmentChoice from '@/components/checkout/FulfillmentChoice.vue'
import OrderSummary from '@/components/checkout/OrderSummary.vue'
import {
  buildOrderRequest,
  hasErrors,
  mapServerErrors,
  validateCheckoutForm,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm,
} from '@/domain/checkout'
import { formatCents } from '@/domain/money'
import { useCartStore } from '@/stores/cart'
import { useMyOrdersStore } from '@/stores/myOrders'

const cart = useCartStore()
const myOrders = useMyOrdersStore()
const router = useRouter()

const form = reactive<CheckoutForm>({ name: '', phone: '', fulfillment: 'pickup', address: '' })
const errors = ref<CheckoutErrors>({})
/** Problems that belong to no input: the cart's lines, or the request failing as a whole. */
const problems = ref<string[]>([])
const submitting = ref(false)
const attempted = ref(false)
/** Set only if the order was placed but the page could not move on to it. */
const placedOrderId = ref<string | null>(null)

const formElement = useTemplateRef<HTMLFormElement>('formEl')
const problemsElement = useTemplateRef<HTMLElement>('problemsEl')

// After the first failed attempt, each field is checked again as it is edited, so its message
// goes away the moment it is fixed. Before that nothing nags the user while they are still typing.
function recheck(field: CheckoutField): void {
  if (!attempted.value) return
  const message = validateCheckoutForm(form)[field]
  const others = Object.fromEntries(Object.entries(errors.value).filter(([key]) => key !== field))
  errors.value = message === undefined ? others : { ...others, [field]: message }
}
watch(
  () => form.name,
  () => {
    recheck('name')
  },
)
watch(
  () => form.phone,
  () => {
    recheck('phone')
  },
)
watch(
  () => form.address,
  () => {
    recheck('address')
  },
)
watch(
  () => form.fulfillment,
  () => {
    recheck('address')
  },
)

async function focusFirstProblem(): Promise<void> {
  await nextTick()
  // The alert comes first: it holds what the user has to know before the fields make sense.
  const field = formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  ;(problemsElement.value ?? field)?.focus()
}

async function submit(): Promise<void> {
  // The button already ignores clicks while loading; this also covers Enter and any other path.
  if (submitting.value) return
  attempted.value = true
  problems.value = []
  errors.value = validateCheckoutForm(form)
  if (hasErrors(errors.value)) {
    await focusFirstProblem()
    return
  }

  submitting.value = true
  try {
    const order = await ordersApi.createOrder(buildOrderRequest(form, cart.lines))
    myOrders.remember(order.id)
    await openPlacedOrder(order.id)
  } catch (caught) {
    if (isApiError(caught) && caught.status === 422) {
      const mapped = mapServerErrors(caught.fieldErrors, cart.lines)
      errors.value = mapped.fields
      problems.value = mapped.general
      if (!hasErrors(mapped.fields) && mapped.general.length === 0) {
        problems.value = [caught.message]
      }
    } else {
      problems.value = [
        isApiError(caught) ? caught.message : 'Something went wrong. Please try again.',
      ]
    }
    await focusFirstProblem()
  } finally {
    submitting.value = false
  }
}

/**
 * The order exists from here on, so whatever happens next the cart is emptied: keeping it would
 * invite a second submit and a duplicate order. `replace`, so Back from the order does not land
 * on a checkout with an empty cart; the cart is cleared after leaving, otherwise this page would
 * flash its empty state first. A navigation that did not happen (a guard, a newer navigation)
 * is not an exception, it is a returned failure, so it is checked for and the user is given a link.
 */
async function openPlacedOrder(orderId: string): Promise<void> {
  let moved: boolean
  try {
    moved = !isNavigationFailure(await router.replace({ name: 'order', params: { id: orderId } }))
  } catch {
    moved = false
  }
  if (!moved) placedOrderId.value = orderId
  cart.clear()
}

const placeLabel = computed(() => `Place order · ${formatCents(cart.subtotalCents)}`)
</script>

<template>
  <section class="checkout">
    <h1>Checkout</h1>

    <div v-if="placedOrderId !== null" class="placed" role="status">
      <p class="placed__title">Your order has been placed.</p>
      <RouterLink :to="{ name: 'order', params: { id: placedOrderId } }">
        Follow order {{ placedOrderId }}
      </RouterLink>
    </div>

    <EmptyState
      v-else-if="cart.isEmpty"
      title="Your cart is empty"
      description="Add a few dishes from the menu, then come back to place your order."
    >
      <template #action>
        <BaseButton @click="router.push({ name: 'menu' })">Browse the menu</BaseButton>
      </template>
    </EmptyState>

    <div v-else class="checkout__layout">
      <form ref="formEl" class="form" novalidate @submit.prevent="submit">
        <div
          v-if="problems.length > 0"
          ref="problemsEl"
          class="problems"
          role="alert"
          tabindex="-1"
        >
          <p class="problems__title">We could not place your order.</p>
          <ul class="problems__list">
            <li v-for="(problem, index) in problems" :key="index">{{ problem }}</li>
          </ul>
        </div>

        <BaseInput
          v-model="form.name"
          label="Name"
          name="name"
          autocomplete="name"
          :error="errors.name"
        />
        <BaseInput
          v-model="form.phone"
          label="Phone"
          name="phone"
          type="tel"
          autocomplete="tel"
          inputmode="tel"
          hint="So we can reach you about your order."
          :error="errors.phone"
        />
        <FulfillmentChoice v-model="form.fulfillment" />
        <BaseInput
          v-if="form.fulfillment === 'delivery'"
          v-model="form.address"
          label="Delivery address"
          name="address"
          autocomplete="street-address"
          :error="errors.address"
        />

        <BaseButton type="submit" block :loading="submitting">{{ placeLabel }}</BaseButton>
      </form>

      <OrderSummary :lines="cart.lines" :total-cents="cart.subtotalCents" />
    </div>
  </section>
</template>

<style scoped>
.checkout {
  display: grid;
  gap: var(--space-5);
}

.checkout__layout {
  display: grid;
  gap: var(--space-5);
  align-items: start;
}

.form {
  display: grid;
  gap: var(--space-4);
}

.placed {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-success-soft);
}

.placed__title {
  font-weight: var(--weight-semibold);
}

.problems {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.problems__title {
  font-weight: var(--weight-semibold);
}

.problems__list {
  margin: var(--space-1) 0 0;
  padding-left: var(--space-5);
}

@media (min-width: 64rem) {
  .checkout__layout {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: var(--space-6);
  }

  /* Summary on the right and in view while the form is long. */
  .checkout__layout > :last-child {
    position: sticky;
    top: var(--space-5);
  }
}
</style>

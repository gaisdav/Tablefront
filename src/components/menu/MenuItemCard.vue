<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import QuantityStepper from '@/components/cart/QuantityStepper.vue'
import { formatCents } from '@/domain/money'
import type { MenuItem } from '@/types/domain'

const { item, quantityInCart = 0 } = defineProps<{
  item: MenuItem
  /** How many of this dish are in the cart already. */
  quantityInCart?: number
}>()

const emit = defineEmits<{
  add: [item: MenuItem]
  /** The new quantity from the stepper; 0 means "remove it". */
  'change-quantity': [item: MenuItem, quantity: number]
}>()

// "Add" turns into the stepper and back, so the button the user just pressed disappears. If focus
// was on it, it goes to where the same finger or key would carry on: the + after adding, "Add"
// after removing. Focus elsewhere (the drawer, another card) is never taken, so the cart changing
// from somewhere else cannot steal it, and no timing between click and render is involved.
const actions = useTemplateRef<HTMLElement>('actions')
const stepper = useTemplateRef<InstanceType<typeof QuantityStepper>>('stepper')

// A `pre` watcher runs before the DOM is patched, so the old control is still there to ask.
watch(
  () => quantityInCart > 0,
  async (hasSome) => {
    const hadFocus = actions.value?.contains(document.activeElement) ?? false
    if (!hadFocus) return
    await nextTick()
    if (hasSome) stepper.value?.focusIncrease()
    else actions.value?.querySelector<HTMLElement>('[data-add]')?.focus()
  },
)
</script>

<template>
  <article class="card" :class="{ 'card--unavailable': !item.available }">
    <div class="card__media">
      <!-- Fixed size and aspect ratio: the box is reserved before the image arrives (no layout shift). -->
      <img
        v-if="item.imageUrl"
        class="card__image"
        :src="item.imageUrl"
        alt=""
        width="400"
        height="300"
        loading="lazy"
        decoding="async"
      />
      <span v-else class="card__placeholder" aria-hidden="true">{{ item.name.charAt(0) }}</span>
    </div>

    <div class="card__body">
      <div class="card__heading">
        <h2 class="card__name">{{ item.name }}</h2>
        <p class="card__price">{{ formatCents(item.priceCents) }}</p>
      </div>
      <p class="card__description">{{ item.description }}</p>
      <!-- The footer sits at the bottom of the card whatever else is (or is not) above it. -->
      <div class="card__footer">
        <ul
          v-if="item.allergens.length > 0"
          class="card__allergens"
          aria-label="Allergens"
          role="list"
        >
          <li v-for="allergen in item.allergens" :key="allergen" class="badge">{{ allergen }}</li>
        </ul>
        <p v-if="!item.available" class="card__status">Sold out</p>
        <div v-else ref="actions" class="card__actions">
          <!-- Same height either way, so the card does not jump when one turns into the other. -->
          <QuantityStepper
            v-if="quantityInCart > 0"
            ref="stepper"
            :model-value="quantityInCart"
            :label="item.name"
            removable
            silent
            @update:model-value="emit('change-quantity', item, $event)"
          />
          <BaseButton
            v-else
            data-add
            variant="secondary"
            :aria-label="`Add ${item.name} to cart`"
            @click="emit('add', item)"
          >
            Add
          </BaseButton>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* Phone: a compact row, thumbnail on the left. Tablet and up: a vertical card in a grid. */
.card {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

/* Only the picture is dimmed: fading the text as well would drop it below AA contrast. */
.card--unavailable .card__media {
  opacity: 0.5;
  filter: grayscale(1);
}

.card__media {
  align-self: start;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-surface-sunken);
}

.card__image,
.card__placeholder {
  width: 100%;
  height: 100%;
}

.card__image {
  object-fit: cover;
}

.card__placeholder {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.card__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.card__name {
  font-size: var(--text-base);
}

.card__price {
  flex: none;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.card__description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card__footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: auto;
}

.card__allergens {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: 0;
  list-style: none;
}

.badge {
  padding: 0.125rem var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  text-transform: capitalize;
}

.card__actions {
  display: flex;
  align-items: center;
  min-height: var(--tap-size);
}

.card__status {
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (min-width: 48rem) {
  .card {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    padding: 0 0 var(--space-4);
    overflow: hidden;
  }

  .card__media {
    align-self: stretch;
    aspect-ratio: 4 / 3;
    border-radius: 0;
  }

  .card__body {
    padding-inline: var(--space-4);
  }

  .card__name {
    font-size: var(--text-lg);
  }
}
</style>

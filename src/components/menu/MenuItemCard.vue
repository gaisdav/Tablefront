<script setup lang="ts">
import { formatCents } from '@/domain/money'
import type { MenuItem } from '@/types/domain'

defineProps<{ item: MenuItem }>()
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
      <ul
        v-if="item.allergens.length > 0"
        class="card__allergens"
        aria-label="Allergens"
        role="list"
      >
        <li v-for="allergen in item.allergens" :key="allergen" class="badge">{{ allergen }}</li>
      </ul>
      <p v-if="!item.available" class="card__status">Sold out</p>
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

.card__allergens {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: auto;
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

.card__status {
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (min-width: 48rem) {
  .card {
    grid-template-columns: 1fr;
    align-content: start;
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

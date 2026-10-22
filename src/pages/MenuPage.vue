<script setup lang="ts">
import { computed } from 'vue'
import { menuApi } from '@/api/menuApi'
import AsyncBoundary from '@/components/AsyncBoundary.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseSkeleton from '@/components/BaseSkeleton.vue'
import EmptyState from '@/components/EmptyState.vue'
import CategoryChips from '@/components/menu/CategoryChips.vue'
import MenuItemCard from '@/components/menu/MenuItemCard.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useMenuFilters } from '@/composables/useMenuFilters'
import { useCartStore } from '@/stores/cart'
import type { MenuItem } from '@/types/domain'

const { category, q, searchInput, setCategory, clearFilters } = useMenuFilters()

const cart = useCartStore()

const categories = useAsyncState((signal) => menuApi.listCategories(signal))

/** The dishes together with the filters they were fetched for. */
interface MenuResult {
  filters: { category: string | undefined; q: string }
  items: MenuItem[]
}

// Runs again, and drops any response still in flight, whenever a filter in the URL changes.
// The result remembers its own filters: while a new request is loading, the page still shows the
// previous result, and the text describing it (count, "no dishes match ...") must describe
// *that* result, not whatever the URL says now.
const menu = useAsyncState(
  async (signal): Promise<MenuResult> => {
    const filters = { category: category.value, q: q.value }
    const items = await menuApi.listMenuItems(
      { categoryId: filters.category, q: filters.q },
      signal,
    )
    return { filters, items }
  },
  { watch: [category, q] },
)

const isNoResults = (result: MenuResult) => result.items.length === 0

// The single live announcement for the list: "Loading…", then the count. (The boundaries below
// get an empty loading label so the same moment is not announced twice.) Errors are announced
// by their own alert, so the line goes quiet instead of repeating a stale count next to it.
const status = computed(() => {
  if (menu.error.value !== null) return ''
  if (menu.isLoading.value) return 'Loading…'
  const count = menu.data.value?.items.length
  if (count === undefined) return ''
  return `${String(count)} ${count === 1 ? 'dish' : 'dishes'}`
})

const shownFilters = computed(() => menu.data.value?.filters)
const hasShownFilters = computed(
  () => shownFilters.value?.category !== undefined || (shownFilters.value?.q ?? '') !== '',
)
const emptyTitle = computed(() => {
  const text = shownFilters.value?.q ?? ''
  return text === '' ? 'No dishes in this category' : `No dishes match “${text}”`
})
</script>

<template>
  <section class="menu">
    <header>
      <h1>Menu</h1>
      <p class="text-muted">Fresh, made to order. Pick up or have it delivered.</p>
    </header>

    <div class="filters">
      <BaseInput
        v-model="searchInput"
        class="filters__search"
        type="search"
        label="Search the menu"
        placeholder="Pizza, pasta, lemonade…"
        autocomplete="off"
        enterkeyhint="search"
      />

      <div class="filters__categories">
        <AsyncBoundary
          :data="categories.data.value"
          :error="categories.error.value"
          :is-loading="categories.isLoading.value"
          loading-label=""
          @retry="categories.execute"
        >
          <template #loading>
            <div class="chips-skeleton">
              <BaseSkeleton
                v-for="n in 4"
                :key="n"
                variant="block"
                width="5.5rem"
                height="2.75rem"
              />
            </div>
          </template>
          <template #error>
            <p class="text-muted">
              Categories could not be loaded.
              <BaseButton variant="ghost" @click="categories.execute">Try again</BaseButton>
            </p>
          </template>
          <template #empty><span /></template>
          <template #default="{ data }">
            <CategoryChips
              :categories="data"
              :model-value="category"
              @update:model-value="setCategory"
            />
          </template>
        </AsyncBoundary>
      </div>
    </div>

    <p class="results text-muted" role="status">{{ status }}</p>

    <div :class="{ 'is-refreshing': menu.data.value !== undefined && menu.isLoading.value }">
      <AsyncBoundary
        :data="menu.data.value"
        :error="menu.error.value"
        :is-loading="menu.isLoading.value"
        :is-empty="isNoResults"
        loading-label=""
        @retry="menu.execute"
      >
        <template #loading>
          <div class="grid">
            <div v-for="n in 6" :key="n" class="card-skeleton">
              <BaseSkeleton variant="block" height="7rem" />
              <BaseSkeleton width="60%" />
              <BaseSkeleton />
            </div>
          </div>
        </template>

        <template #empty>
          <EmptyState
            :title="emptyTitle"
            :description="
              hasShownFilters ? 'Try a different word or clear the filters.' : undefined
            "
          >
            <template v-if="hasShownFilters" #action>
              <BaseButton variant="secondary" @click="clearFilters">Clear filters</BaseButton>
            </template>
          </EmptyState>
        </template>

        <template #default="{ data }">
          <ul class="grid" role="list">
            <li v-for="item in data.items" :key="item.id">
              <MenuItemCard
                :item="item"
                :quantity-in-cart="cart.quantityOf(item.id)"
                @add="cart.add($event)"
              />
            </li>
          </ul>
        </template>
      </AsyncBoundary>
    </div>
  </section>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.filters {
  display: grid;
  /* minmax(0, ...): without it the nowrap chip row widens the column past the screen. */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
}

.filters__categories {
  min-width: 0;
}

.chips-skeleton {
  display: flex;
  gap: var(--space-2);
}

.results {
  min-height: 1.5em;
  font-size: var(--text-sm);
}

.grid {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}

.card-skeleton {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

/* Old results stay visible while new ones load; dimming says "these are on their way out". It
   covers whatever is showing: the list, or the empty state. */
.is-refreshing {
  opacity: 0.55;
  transition: opacity var(--duration-base) var(--ease-out);
}

@media (min-width: 48rem) {
  .filters {
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
    align-items: end;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }
}

@media (min-width: 64rem) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 80rem) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>

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

const { category, q, searchInput, setCategory, clearFilters } = useMenuFilters()

const categories = useAsyncState((signal) => menuApi.listCategories(signal))

// Runs again, and drops any response still in flight, whenever a filter in the URL changes.
const items = useAsyncState(
  (signal) => menuApi.listMenuItems({ categoryId: category.value, q: q.value }, signal),
  {
    watch: [category, q],
  },
)

const hasFilters = computed(() => category.value !== undefined || q.value !== '')

const resultCount = computed(() => {
  const count = items.data.value?.length
  if (count === undefined) return ''
  return `${String(count)} ${count === 1 ? 'dish' : 'dishes'}`
})

const emptyTitle = computed(() =>
  q.value === '' ? 'No dishes in this category' : `No dishes match “${q.value}”`,
)
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
          loading-label="Loading categories"
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

    <p class="results text-muted" role="status">{{ resultCount }}</p>

    <div :class="{ 'is-refreshing': items.data.value !== undefined && items.isLoading.value }">
      <AsyncBoundary
        :data="items.data.value"
        :error="items.error.value"
        :is-loading="items.isLoading.value"
        loading-label="Loading the menu"
        @retry="items.execute"
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
            :description="hasFilters ? 'Try a different word or clear the filters.' : undefined"
          >
            <template v-if="hasFilters" #action>
              <BaseButton variant="secondary" @click="clearFilters">Clear filters</BaseButton>
            </template>
          </EmptyState>
        </template>

        <template #default="{ data }">
          <ul class="grid" role="list">
            <li v-for="item in data" :key="item.id">
              <MenuItemCard :item="item" />
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

/* Old results stay visible while new ones load; dimming says "these are on their way out". */
.is-refreshing .grid {
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

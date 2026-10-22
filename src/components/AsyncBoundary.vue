<script setup lang="ts" generic="T extends object">
import BaseSkeleton from '@/components/BaseSkeleton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

/**
 * Presentational: it knows nothing about stores or the API. Feed it the state of
 * `useAsyncState` and it renders exactly one of four things, in this order:
 *   error > loading (no data yet) > empty > content.
 * Data that is still on screen while a re-run loads stays visible, marked with aria-busy.
 * `T` is an object or array, which is all this API returns.
 */
const {
  data,
  error,
  isLoading,
  isEmpty = (value: unknown) => Array.isArray(value) && value.length === 0,
  loadingLabel = 'Loading',
} = defineProps<{
  data: T | undefined
  error: Error | null
  isLoading: boolean
  /** Decides whether `data` counts as empty. Default: an empty array. */
  isEmpty?: (data: T) => boolean
  loadingLabel?: string
}>()

const emit = defineEmits<{ retry: [] }>()

defineSlots<{
  default(props: { data: T }): unknown
  loading?(): unknown
  error?(props: { error: Error; retry: () => void }): unknown
  empty?(): unknown
}>()

function retry(): void {
  emit('retry')
}
</script>

<template>
  <div :aria-busy="isLoading || undefined">
    <slot v-if="error" name="error" :error="error" :retry="retry">
      <ErrorState :message="error.message" @retry="retry" />
    </slot>

    <!-- Also covers "idle": no data, no error and not loading yet, i.e. before the first run. -->
    <div v-else-if="data === undefined" role="status">
      <span class="visually-hidden">{{ loadingLabel }}</span>
      <div class="loading" aria-hidden="true">
        <slot name="loading">
          <BaseSkeleton width="40%" />
          <BaseSkeleton />
          <BaseSkeleton variant="block" />
        </slot>
      </div>
    </div>

    <slot v-else-if="isEmpty(data)" name="empty">
      <EmptyState title="Nothing here yet" />
    </slot>

    <slot v-else :data="data" />
  </div>
</template>

<style scoped>
.loading {
  display: grid;
  gap: var(--space-3);
}
</style>

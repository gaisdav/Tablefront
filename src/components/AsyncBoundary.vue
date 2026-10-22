<script setup lang="ts" generic="T extends object">
import { isApiError } from '@/api/errors'
import BaseSkeleton from '@/components/BaseSkeleton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

/**
 * Presentational: it knows nothing about stores or the API. Feed it the state of
 * `useAsyncState` and it renders exactly one of four things, in this order:
 *   error > loading (no data yet) > empty > content,
 * or nothing at all while idle (nothing has run yet, or the run was cancelled).
 * Data that is still on screen while a re-run loads stays visible, marked with aria-busy.
 * `T` is an object or array, which is all this API returns.
 */
const {
  data,
  error,
  isLoading,
  isEmpty = (value: unknown) => Array.isArray(value) && value.length === 0,
  loadingLabel = 'Loading',
  // Messages from the API layer are written for users. Anything else (a TypeError from a bug,
  // a library error) is technical and could leak details, so it is replaced.
  errorMessage = (error: Error) =>
    isApiError(error) ? error.message : 'An unexpected problem occurred. Please try again.',
} = defineProps<{
  data: T | undefined
  error: Error | null
  isLoading: boolean
  /** Decides whether `data` counts as empty. Default: an empty array. */
  isEmpty?: (data: T) => boolean
  loadingLabel?: string
  /** Turns the error into the text the user sees. Default: API messages, a generic text otherwise. */
  errorMessage?: (error: Error) => string
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
      <ErrorState :message="errorMessage(error)" @retry="retry" />
    </slot>

    <div v-else-if="data === undefined && isLoading" role="status">
      <span class="visually-hidden">{{ loadingLabel }}</span>
      <div class="loading" aria-hidden="true">
        <slot name="loading">
          <BaseSkeleton width="40%" />
          <BaseSkeleton />
          <BaseSkeleton variant="block" />
        </slot>
      </div>
    </div>

    <!-- Idle: nothing has run (or the run was cancelled) and there is nothing to show yet. -->
    <template v-else-if="data === undefined" />

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

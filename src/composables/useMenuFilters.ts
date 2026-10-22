import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryValue } from 'vue-router'
import { useDebouncedRef } from '@/composables/useDebouncedRef'

export const SEARCH_DEBOUNCE_MS = 300

function firstString(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first === null || first === undefined || first === '' ? undefined : first
}

function withParam(query: LocationQuery, name: string, value: string | undefined): LocationQuery {
  const others = Object.fromEntries(Object.entries(query).filter(([key]) => key !== name))
  return value === undefined || value === '' ? others : { ...others, [name]: value }
}

/**
 * The menu's filters, with the URL as the single source of truth: `?category=<id>&q=<text>`.
 * The view is shareable and survives a reload because nothing lives only in component state,
 * except the text being typed, which reaches the URL once the user pauses.
 */
export function useMenuFilters() {
  const route = useRoute()
  const router = useRouter()

  const category = computed(() => firstString(route.query.category))
  const q = computed(() => firstString(route.query.q) ?? '')

  /** Bound to the search box: updates on every keystroke. */
  const searchInput = ref(q.value)
  const debouncedSearch = useDebouncedRef(searchInput, SEARCH_DEBOUNCE_MS)

  // Typing -> URL. `replace`, so a burst of searches does not fill the history with entries.
  watch(debouncedSearch, (value) => {
    const text = value.trim()
    if (text !== q.value) void router.replace({ query: withParam(route.query, 'q', text) })
  })

  // URL -> input, for back/forward and shared links. A change we just wrote ourselves equals the
  // debounced text and is skipped, so it cannot overwrite what the user has typed since.
  watch(q, (value) => {
    if (value !== debouncedSearch.value.trim()) searchInput.value = value
  })

  function setCategory(id: string | undefined): void {
    // `push`: choosing a category is a navigation the back button should undo.
    void router.push({ query: withParam(route.query, 'category', id) })
  }

  function clearFilters(): void {
    searchInput.value = ''
    void router.push({ query: {} })
  }

  return { category, q, searchInput, setCategory, clearFilters }
}

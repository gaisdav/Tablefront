import { computed, reactive, ref, watch } from 'vue'
import { adminApi } from '@/api/adminApi'
import { isApiError } from '@/api/errors'
import { menuApi } from '@/api/menuApi'
import { useAsyncState } from '@/composables/useAsyncState'
import { inputFromItem, mapMenuServerErrors, type MenuErrors } from '@/domain/menuForm'
import { useToastsStore } from '@/stores/toasts'
import type { MenuItemInput } from '@/types/api'
import type { Category, MenuItem } from '@/types/domain'

export type SaveResult =
  { ok: true; item: MenuItem } | { ok: false; fields: MenuErrors; general: string[] }

/** The same order the API uses: grouped by category, and within one in the order added. */
function inCategoryOrder(items: readonly MenuItem[], categories: readonly Category[]): MenuItem[] {
  const rank = new Map(categories.map((category) => [category.id, category.sortOrder]))
  return [...items].sort((a, b) => (rank.get(a.categoryId) ?? 0) - (rank.get(b.categoryId) ?? 0))
}

/**
 * The menu as the admin edits it: every dish (also the unavailable ones), with changes applied to
 * a local copy as soon as the server has agreed, except the availability switch, which is applied
 * at once and undone if the server refuses.
 */
export function useAdminMenu() {
  const toasts = useToastsStore()
  const loadedCategories = useAsyncState((signal) => menuApi.listCategories(signal))
  const loadedItems = useAsyncState((signal) => menuApi.listMenuItems({}, signal))

  /** The page's working copy of the dishes; what the server last sent, plus what was changed since. */
  const items = ref<MenuItem[]>()
  const saving = reactive(new Set<string>())

  // Side effect: a fresh load (first, or "Try again") replaces the working copy.
  watch(loadedItems.data, (fresh) => {
    items.value = fresh
  })

  const categories = computed(() => loadedCategories.data.value ?? [])
  const isLoading = computed(() => loadedItems.isLoading.value || loadedCategories.isLoading.value)
  const error = computed(() => loadedItems.error.value ?? loadedCategories.error.value)

  function reload(): void {
    void loadedItems.execute()
    void loadedCategories.execute()
  }

  function replaceItem(item: MenuItem): void {
    items.value = (items.value ?? []).map((candidate) =>
      candidate.id === item.id ? item : candidate,
    )
  }

  async function setAvailable(id: string, available: boolean): Promise<void> {
    const before = items.value?.find((item) => item.id === id)
    if (before === undefined || saving.has(id) || before.available === available) return

    saving.add(id)
    replaceItem({ ...before, available })
    try {
      replaceItem(await adminApi.updateMenuItem(id, inputFromItem({ ...before, available })))
      toasts.info(`${before.name} is now ${available ? 'available' : 'sold out'}.`)
    } catch (caught) {
      replaceItem(before)
      if (!(isApiError(caught) && caught.status === 401)) {
        const reason = isApiError(caught) ? caught.message : 'Something went wrong.'
        toasts.error(`${before.name} was not changed. ${reason}`)
      }
    } finally {
      saving.delete(id)
    }
  }

  /** Creates a dish, or saves changes to `id`. Never throws: the outcome says what went wrong. */
  async function save(input: MenuItemInput, id?: string): Promise<SaveResult> {
    try {
      const item =
        id === undefined
          ? await adminApi.createMenuItem(input)
          : await adminApi.updateMenuItem(id, input)
      const others = (items.value ?? []).filter((candidate) => candidate.id !== item.id)
      items.value = inCategoryOrder([...others, item], categories.value)
      return { ok: true, item }
    } catch (caught) {
      if (isApiError(caught) && caught.status === 422) {
        return { ok: false, ...mapMenuServerErrors(caught.fieldErrors) }
      }
      // A 401 is already taking the user to the login page; nothing to add.
      if (isApiError(caught) && caught.status === 401) return { ok: false, fields: {}, general: [] }
      return {
        ok: false,
        fields: {},
        general: [isApiError(caught) ? caught.message : 'Something went wrong. Please try again.'],
      }
    }
  }

  /** Deletes a dish; true when it is gone (including when it was already gone). */
  async function remove(id: string): Promise<boolean> {
    const item = items.value?.find((candidate) => candidate.id === id)
    try {
      await adminApi.deleteMenuItem(id)
    } catch (caught) {
      // Already deleted elsewhere: the goal is reached, so just bring the list in line.
      if (!(isApiError(caught) && caught.status === 404)) {
        if (!(isApiError(caught) && caught.status === 401)) {
          const reason = isApiError(caught) ? caught.message : 'Something went wrong.'
          toasts.error(`${item?.name ?? 'The dish'} was not deleted. ${reason}`)
        }
        return false
      }
    }
    items.value = (items.value ?? []).filter((candidate) => candidate.id !== id)
    if (item !== undefined) toasts.info(`${item.name} was deleted.`)
    return true
  }

  return { items, categories, isLoading, error, reload, saving, setAvailable, save, remove }
}

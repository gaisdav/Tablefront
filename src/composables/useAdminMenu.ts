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

/**
 * Puts a saved dish into the list. A dish that stays in its category keeps its place (an edit must
 * not send it to the bottom); a new one, or one moved to another category, goes at the end of its
 * category, which is where the API would put a new one. The list stays grouped by category.
 */
function place(
  items: readonly MenuItem[],
  saved: MenuItem,
  categories: readonly Category[],
): MenuItem[] {
  const rank = new Map(categories.map((category) => [category.id, category.sortOrder]))
  const old = items.find((item) => item.id === saved.id)
  const next =
    old?.categoryId === saved.categoryId
      ? items.map((item) => (item.id === saved.id ? saved : item))
      : [...items.filter((item) => item.id !== saved.id), saved]
  return next.sort((a, b) => (rank.get(a.categoryId) ?? 0) - (rank.get(b.categoryId) ?? 0))
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
  const working = ref<MenuItem[]>()
  const saving = reactive(new Set<string>())

  // Side effect: a fresh load (first, or "Try again") replaces the working copy, but not a change
  // that is still on its way: its dish keeps the availability the user chose until it settles.
  watch(loadedItems.data, (fresh) => {
    const current = working.value
    working.value = fresh?.map((item) => {
      const mine = saving.has(item.id) ? current?.find((c) => c.id === item.id) : undefined
      return mine === undefined ? item : { ...item, available: mine.available }
    })
  })

  const categories = computed(() => loadedCategories.data.value ?? [])

  /**
   * The dishes, once the categories are known too: a form opened before they arrived would start
   * with no category to choose and never find out that they came.
   */
  const items = computed(() =>
    loadedCategories.data.value === undefined ? undefined : working.value,
  )
  const isLoading = computed(() => loadedItems.isLoading.value || loadedCategories.isLoading.value)
  const error = computed(() => loadedItems.error.value ?? loadedCategories.error.value)

  function reload(): void {
    void loadedItems.execute()
    void loadedCategories.execute()
  }

  /** Changes one field of one dish and leaves everything else as it is now. */
  function patchItem(id: string, change: Partial<MenuItem>): void {
    working.value = (working.value ?? []).map((candidate) =>
      candidate.id === id ? { ...candidate, ...change } : candidate,
    )
  }

  async function setAvailable(id: string, available: boolean): Promise<void> {
    const before = working.value?.find((item) => item.id === id)
    if (before === undefined || saving.has(id) || before.available === available) return

    saving.add(id)
    patchItem(id, { available })
    try {
      // Only `available` is touched when it settles (the server's answer is not written back), so
      // nothing else changed in the meantime can be overwritten with an older copy.
      await adminApi.updateMenuItem(id, inputFromItem({ ...before, available }))
      toasts.info(`${before.name} is now ${available ? 'available' : 'sold out'}.`)
    } catch (caught) {
      patchItem(id, { available: before.available })
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
    // A change to this dish is on its way; saving over it now could send a state about to be undone.
    if (id !== undefined && saving.has(id)) {
      return {
        ok: false,
        fields: {},
        general: ['This dish is being updated. Try again in a moment.'],
      }
    }
    try {
      const item =
        id === undefined
          ? await adminApi.createMenuItem(input)
          : await adminApi.updateMenuItem(id, input)
      working.value = place(working.value ?? [], item, categories.value)
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
    const item = working.value?.find((candidate) => candidate.id === id)
    if (saving.has(id)) {
      toasts.error(`${item?.name ?? 'The dish'} is being updated. Try again in a moment.`)
      return false
    }
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
    working.value = (working.value ?? []).filter((candidate) => candidate.id !== id)
    if (item !== undefined) toasts.info(`${item.name} was deleted.`)
    return true
  }

  return { items, categories, isLoading, error, reload, saving, setAvailable, save, remove }
}

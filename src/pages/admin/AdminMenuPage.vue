<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminMenuList from '@/components/admin/AdminMenuList.vue'
import MenuItemForm from '@/components/admin/MenuItemForm.vue'
import AsyncBoundary from '@/components/AsyncBoundary.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import BaseInput from '@/components/BaseInput.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAdminMenu } from '@/composables/useAdminMenu'
import { useConfirm } from '@/composables/useConfirm'
import { SEARCH_DEBOUNCE_MS } from '@/composables/useMenuFilters'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { useToastsStore } from '@/stores/toasts'
import type { MenuItem } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const menu = useAdminMenu()
const toasts = useToastsStore()
const confirm = useConfirm()

// The search text lives in the URL, so a reload or a shared link keeps it. Filtering is done here,
// on the dishes already loaded, straight from what is typed; the URL follows once the user pauses
// (the same arrangement as the guest menu), so typing never waits for the router.
const urlSearch = computed(() => {
  const value = route.query.q
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
})
const search = ref(urlSearch.value)
const settledSearch = useDebouncedRef(search, SEARCH_DEBOUNCE_MS)

// Typing -> URL. `replace`: a burst of searches must not fill the history.
watch(settledSearch, (text) => {
  const others = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'q'))
  void router.replace({ query: text.trim() === '' ? others : { ...others, q: text.trim() } })
})

// URL -> input, for back/forward and shared links; what we wrote ourselves is skipped.
watch(urlSearch, (value) => {
  if (value !== settledSearch.value.trim()) search.value = value
})

const visible = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (menu.items.value ?? []).filter(
    (item) =>
      query === '' ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query),
  )
})

// --- the add/edit form -------------------------------------------------------------------------

const formOpen = ref(false)
const editing = ref<MenuItem>()
const formDirty = ref(false)

function openCreate(): void {
  editing.value = undefined
  formOpen.value = true
}

function openEdit(item: MenuItem): void {
  editing.value = item
  formOpen.value = true
}

function closeForm(): void {
  formOpen.value = false
  formDirty.value = false
}

// Every way of closing the form (Cancel, the close button, Escape, the backdrop) comes through
// here, so unsaved changes are never thrown away without asking.
async function requestClose(): Promise<void> {
  if (formDirty.value) {
    const discard = await confirm.confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes to this dish. If you close the form they will be lost.',
      confirmLabel: 'Discard changes',
      destructive: true,
    })
    if (!discard) return
  }
  closeForm()
}

const dialogOpen = computed({
  get: () => formOpen.value,
  set: (open) => {
    if (!open) void requestClose()
  },
})

function onSaved(item: MenuItem): void {
  closeForm()
  toasts.info(`${item.name} was saved.`)
}

// Leaving the page (a link, the back button, closing the tab) with a half-filled form asks first.
useUnsavedChangesGuard(
  () => formOpen.value && formDirty.value,
  () =>
    confirm.confirm({
      title: 'Leave without saving?',
      message: 'You have unsaved changes to a dish. If you leave this page they will be lost.',
      confirmLabel: 'Leave page',
      destructive: true,
    }),
)

// --- deleting -----------------------------------------------------------------------------------

const heading = useTemplateRef<HTMLElement>('heading')

async function askDelete(item: MenuItem): Promise<void> {
  const yes = await confirm.confirm({
    title: `Delete ${item.name}?`,
    message: 'The dish is removed from the menu for good. This cannot be undone.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!yes || !(await menu.remove(item.id))) return
  // The row that had focus is gone; put it somewhere sensible instead of at the top of the page.
  await nextTick()
  heading.value?.focus()
}
</script>

<template>
  <section class="menu">
    <header class="menu__head">
      <h1 ref="heading" tabindex="-1">Menu</h1>
      <BaseButton @click="openCreate">Add dish</BaseButton>
    </header>

    <AsyncBoundary
      :data="menu.items.value"
      :error="menu.error.value"
      :is-loading="menu.isLoading.value"
      loading-label="Loading the menu"
      @retry="menu.reload"
    >
      <template #empty>
        <EmptyState title="No dishes yet" description="Add the first dish to start the menu.">
          <template #action>
            <BaseButton @click="openCreate">Add dish</BaseButton>
          </template>
        </EmptyState>
      </template>

      <template #default>
        <BaseInput
          v-model="search"
          class="menu__search"
          label="Search dishes"
          type="search"
          autocomplete="off"
          placeholder="Name or description"
        />

        <p class="text-muted" role="status">
          {{ visible.length }} of {{ menu.items.value?.length }}
          {{ menu.items.value?.length === 1 ? 'dish' : 'dishes' }}
        </p>

        <AdminMenuList
          v-if="visible.length > 0"
          :items="visible"
          :categories="menu.categories.value"
          :saving="menu.saving"
          @set-available="(item, available) => menu.setAvailable(item.id, available)"
          @edit="openEdit"
          @delete="askDelete"
        />
        <EmptyState
          v-else
          title="No dishes match"
          :description="`Nothing matches “${search.trim()}”.`"
        >
          <template #action>
            <BaseButton variant="secondary" @click="search = ''">Clear search</BaseButton>
          </template>
        </EmptyState>
      </template>
    </AsyncBoundary>

    <BaseDialog
      v-model:open="dialogOpen"
      :title="editing === undefined ? 'Add a dish' : `Edit ${editing.name}`"
    >
      <MenuItemForm
        :item="editing"
        :categories="menu.categories.value"
        :save="menu.save"
        @saved="onSaved"
        @cancel="requestClose"
        @dirty-change="formDirty = $event"
      />
    </BaseDialog>

    <ConfirmDialog :request="confirm.request.value" @answer="confirm.answer" />
  </section>
</template>

<style scoped>
.menu {
  display: grid;
  gap: var(--space-4);
}

.menu__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.menu__head h1:focus {
  outline: none;
}

.menu__search {
  max-width: 24rem;
}
</style>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCheckbox from '@/components/BaseCheckbox.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import type { SaveResult } from '@/composables/useAdminMenu'
import {
  emptyMenuForm,
  formFromItem,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  sameForm,
  toMenuItemInput,
  validateMenuForm,
  type MenuErrors,
  type MenuField,
  type MenuForm,
} from '@/domain/menuForm'
import type { MenuItemInput } from '@/types/api'
import { ALLERGENS, type Allergen, type Category, type MenuItem } from '@/types/domain'

const { item, categories, save } = defineProps<{
  /** The dish being edited; none means a new one. */
  item?: MenuItem
  categories: readonly Category[]
  /** Sends the dish to the server. Never throws; the result says what went wrong. */
  save: (input: MenuItemInput, id?: string) => Promise<SaveResult>
}>()

const emit = defineEmits<{
  saved: [item: MenuItem]
  cancel: []
  /** Whether the form holds changes that are not saved yet. */
  'dirty-change': [dirty: boolean]
}>()

// Created fresh each time the dialog opens, so these start from the dish (or an empty form).
const initial = item === undefined ? emptyMenuForm(categories) : formFromItem(item)
const form = reactive<MenuForm>({ ...initial, allergens: [...initial.allergens] })
const errors = ref<MenuErrors>({})
const problems = ref<string[]>([])
const submitting = ref(false)
const attempted = ref(false)

const formElement = useTemplateRef<HTMLFormElement>('formEl')
const problemsElement = useTemplateRef<HTMLElement>('problemsEl')

const dirty = computed(() => !sameForm(form, initial))
watch(
  dirty,
  (value) => {
    emit('dirty-change', value)
  },
  { immediate: true },
)

const categoryOptions = computed(() =>
  categories.map((category) => ({ value: category.id, label: category.name })),
)

// After the first failed attempt, each field is checked again as it is edited (so its message goes
// away the moment it is fixed); before that nothing nags while the user is still typing.
function recheck(field: MenuField): void {
  if (!attempted.value) return
  const message = validateMenuForm(form, categories)[field]
  const others = Object.fromEntries(Object.entries(errors.value).filter(([key]) => key !== field))
  errors.value = message === undefined ? others : { ...others, [field]: message }
}
for (const field of ['name', 'description', 'price', 'categoryId', 'imageUrl'] as const) {
  watch(
    () => form[field],
    () => {
      recheck(field)
    },
  )
}

function toggleAllergen(allergen: Allergen, on: boolean): void {
  form.allergens = on
    ? [...form.allergens, allergen]
    : form.allergens.filter((chosen) => chosen !== allergen)
}

async function focusFirstProblem(): Promise<void> {
  await nextTick()
  // The alert first: it holds what the user has to know before the fields make sense.
  const field = formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  ;(problemsElement.value ?? field)?.focus()
}

async function submit(): Promise<void> {
  if (submitting.value) return
  attempted.value = true
  problems.value = []
  errors.value = validateMenuForm(form, categories)
  const input = toMenuItemInput(form)
  if (Object.keys(errors.value).length > 0 || input === null) {
    await focusFirstProblem()
    return
  }

  submitting.value = true
  try {
    const result = await save(input, item?.id)
    if (result.ok) {
      emit('saved', result.item)
      return
    }
    errors.value = result.fields
    problems.value = result.general
    await focusFirstProblem()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form ref="formEl" class="form" novalidate @submit.prevent="submit">
    <div v-if="problems.length > 0" ref="problemsEl" class="problems" role="alert" tabindex="-1">
      <p class="problems__title">The dish was not saved.</p>
      <ul class="problems__list">
        <li v-for="(problem, index) in problems" :key="index">{{ problem }}</li>
      </ul>
    </div>

    <BaseInput
      v-model="form.name"
      label="Name"
      name="name"
      autocomplete="off"
      :maxlength="MAX_NAME_LENGTH + 20"
      :error="errors.name"
    />
    <BaseInput
      v-model="form.description"
      label="Description"
      name="description"
      multiline
      :hint="`Up to ${String(MAX_DESCRIPTION_LENGTH)} characters.`"
      :error="errors.description"
    />
    <div class="row">
      <BaseInput
        v-model="form.price"
        label="Price (€)"
        name="price"
        inputmode="decimal"
        autocomplete="off"
        placeholder="11.50"
        :error="errors.price"
      />
      <BaseSelect
        v-model="form.categoryId"
        label="Category"
        name="categoryId"
        :options="categoryOptions"
        :error="errors.categoryId"
      />
    </div>
    <BaseInput
      v-model="form.imageUrl"
      label="Image address"
      name="imageUrl"
      type="url"
      autocomplete="off"
      hint="Optional. An http(s) address."
      :error="errors.imageUrl"
    />

    <fieldset class="allergens" :aria-invalid="errors.allergens ? true : undefined">
      <legend class="allergens__legend">Allergens</legend>
      <div class="allergens__list">
        <BaseCheckbox
          v-for="allergen in ALLERGENS"
          :key="allergen"
          :model-value="form.allergens.includes(allergen)"
          :label="allergen"
          @update:model-value="toggleAllergen(allergen, $event)"
        />
      </div>
      <p v-if="errors.allergens" class="allergens__error">{{ errors.allergens }}</p>
    </fieldset>

    <BaseCheckbox v-model="form.available" label="Available to order" />

    <div class="actions">
      <BaseButton variant="secondary" @click="emit('cancel')">Cancel</BaseButton>
      <BaseButton type="submit" :loading="submitting">
        {{ item === undefined ? 'Add dish' : 'Save changes' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: var(--space-4);
}

.row {
  display: grid;
  gap: var(--space-4);
}

.problems {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.problems__title {
  font-weight: var(--weight-semibold);
}

.problems__list {
  margin: var(--space-1) 0 0;
  padding-left: var(--space-5);
}

.allergens {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.allergens__legend {
  padding: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.allergens__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-4);
}

.allergens__list :deep(.check) {
  text-transform: capitalize;
}

.allergens__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (min-width: 40rem) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

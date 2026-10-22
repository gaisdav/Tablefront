import { parseMoneyToCents, centsToInput } from '@/domain/money'
import type { MenuItemInput } from '@/types/api'
import { ALLERGENS, type Allergen, type Category, type MenuItem } from '@/types/domain'

/** What the dish form holds. The price is the text the user typed; the rest is what the API takes. */
export interface MenuForm {
  name: string
  description: string
  price: string
  categoryId: string
  imageUrl: string
  available: boolean
  allergens: Allergen[]
}

export type MenuField = 'name' | 'description' | 'price' | 'categoryId' | 'imageUrl' | 'allergens'
export type MenuErrors = Partial<Record<MenuField, string>>

// The same limits the API enforces, so the form catches the mistakes the server would.
export const MAX_NAME_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 500
/** Not an API limit: a guard against pasting something huge (an inline image can be long, a typed address is not). */
export const MAX_IMAGE_URL_LENGTH = 2000

export function emptyMenuForm(categories: readonly Category[]): MenuForm {
  return {
    name: '',
    description: '',
    price: '',
    categoryId: categories[0]?.id ?? '',
    imageUrl: '',
    available: true,
    allergens: [],
  }
}

export function formFromItem(item: MenuItem): MenuForm {
  return {
    name: item.name,
    description: item.description,
    price: centsToInput(item.priceCents),
    categoryId: item.categoryId,
    imageUrl: item.imageUrl ?? '',
    available: item.available,
    allergens: [...item.allergens],
  }
}

/** Whether two forms hold the same thing; the order allergens were ticked in does not matter. */
export function sameForm(a: MenuForm, b: MenuForm): boolean {
  const sorted = (list: readonly Allergen[]) =>
    ALLERGENS.filter((allergen) => list.includes(allergen))
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.price === b.price &&
    a.categoryId === b.categoryId &&
    a.imageUrl === b.imageUrl &&
    a.available === b.available &&
    sorted(a.allergens).join() === sorted(b.allergens).join()
  )
}

function isImageUrl(text: string): boolean {
  if (text.startsWith('data:image/')) return true
  try {
    const { protocol } = new URL(text)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function validateMenuForm(form: MenuForm, categories: readonly Category[]): MenuErrors {
  const errors: MenuErrors = {}

  const name = form.name.trim()
  if (name === '') errors.name = 'Name is required'
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${String(MAX_NAME_LENGTH)} characters or fewer`
  }

  if (form.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${String(MAX_DESCRIPTION_LENGTH)} characters or fewer`
  }

  const cents = parseMoneyToCents(form.price)
  if (form.price.trim() === '') errors.price = 'Price is required'
  else if (cents === null) errors.price = 'Enter a price like 11.50'
  else if (cents < 1) errors.price = 'Price must be more than zero'

  if (!categories.some((category) => category.id === form.categoryId)) {
    errors.categoryId = 'Choose a category'
  }

  const imageUrl = form.imageUrl.trim()
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    errors.imageUrl = `Keep the address under ${String(MAX_IMAGE_URL_LENGTH)} characters`
  } else if (imageUrl !== '' && !isImageUrl(imageUrl)) {
    errors.imageUrl = 'Use an http(s) address, or leave it empty'
  }
  return errors
}

/** The request for a form that passed `validateMenuForm`; null if it did not. */
export function toMenuItemInput(form: MenuForm): MenuItemInput | null {
  const cents = parseMoneyToCents(form.price)
  if (cents === null) return null
  const imageUrl = form.imageUrl.trim()
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    priceCents: cents,
    categoryId: form.categoryId,
    imageUrl: imageUrl === '' ? null : imageUrl,
    available: form.available,
    allergens: ALLERGENS.filter((allergen) => form.allergens.includes(allergen)),
  }
}

/** A dish as the request that would save it unchanged (used to flip one field, like availability). */
export function inputFromItem(item: MenuItem): MenuItemInput {
  return {
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    categoryId: item.categoryId,
    imageUrl: item.imageUrl,
    available: item.available,
    allergens: item.allergens,
  }
}

const SERVER_FIELDS: Record<string, MenuField> = {
  name: 'name',
  description: 'description',
  priceCents: 'price',
  categoryId: 'categoryId',
  imageUrl: 'imageUrl',
  allergens: 'allergens',
}

/** Puts the API's `fields` on the form's inputs; anything it does not know comes back as a sentence. */
export function mapMenuServerErrors(fieldErrors: Readonly<Record<string, string>>): {
  fields: MenuErrors
  general: string[]
} {
  const fields: MenuErrors = {}
  const general: string[] = []
  for (const [key, message] of Object.entries(fieldErrors)) {
    const field = SERVER_FIELDS[key]
    if (field === undefined) general.push(message)
    else fields[field] = message
  }
  return { fields, general }
}

import { isAllergen, isFulfillment, isRecord } from '@/domain/guards'
import type { MenuItemInput } from '@/types/api'
import type { MenuItem, Order } from '@/types/domain'

export type Validation<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> }

const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/
const MAX_QUANTITY = 99

function text(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}

/**
 * Field names in `fields` are the contract the checkout form maps back onto its inputs:
 * `customer.name`, `customer.phone`, `customer.address`, `fulfillment`, `lines`,
 * `lines.<index>.menuItemId` and `lines.<index>.quantity`.
 */
export function validateOrder(
  body: unknown,
  findMenuItem: (id: string) => MenuItem | undefined,
): Validation<Pick<Order, 'lines' | 'fulfillment' | 'customer'>> {
  const fields: Record<string, string> = {}
  const input = isRecord(body) ? body : {}
  const customerInput = isRecord(input.customer) ? input.customer : {}

  const name = text(customerInput.name)
  if (name === null || name === '') fields['customer.name'] = 'Name is required'

  const phone = text(customerInput.phone)
  if (phone === null || phone === '') fields['customer.phone'] = 'Phone is required'
  else if (!PHONE_PATTERN.test(phone)) fields['customer.phone'] = 'Phone number looks invalid'

  const fulfillment = input.fulfillment
  if (!isFulfillment(fulfillment)) fields.fulfillment = 'Choose pickup or delivery'

  const address = text(customerInput.address)
  if (fulfillment === 'delivery' && (address === null || address === '')) {
    fields['customer.address'] = 'Address is required for delivery'
  }

  const lines: Order['lines'] = []
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    fields.lines = 'Add at least one item'
  } else {
    input.lines.forEach((raw: unknown, index) => {
      const lineInput = isRecord(raw) ? raw : {}
      const item =
        typeof lineInput.menuItemId === 'string' ? findMenuItem(lineInput.menuItemId) : undefined
      const quantity = lineInput.quantity
      const key = `lines.${String(index)}`

      if (item === undefined) fields[`${key}.menuItemId`] = 'Unknown menu item'
      else if (!item.available) fields[`${key}.menuItemId`] = `${item.name} is no longer available`

      const quantityOk =
        typeof quantity === 'number' &&
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= MAX_QUANTITY
      if (!quantityOk)
        fields[`${key}.quantity`] = `Quantity must be between 1 and ${String(MAX_QUANTITY)}`

      if (item?.available === true && quantityOk) {
        const note = text(lineInput.note)
        lines.push({
          menuItemId: item.id,
          name: item.name,
          unitPriceCents: item.priceCents,
          quantity,
          ...(note === null || note === '' ? {} : { note }),
        })
      }
    })
  }

  if (
    Object.keys(fields).length > 0 ||
    name === null ||
    phone === null ||
    !isFulfillment(fulfillment)
  ) {
    return { ok: false, fields }
  }
  return {
    ok: true,
    value: {
      lines,
      fulfillment,
      customer: {
        name,
        phone,
        ...(fulfillment === 'delivery' && address !== null ? { address } : {}),
      },
    },
  }
}

export function validateMenuItem(
  body: unknown,
  categoryExists: (id: string) => boolean,
): Validation<MenuItemInput> {
  const fields: Record<string, string> = {}
  const input = isRecord(body) ? body : {}

  const name = text(input.name)
  if (name === null || name === '') fields.name = 'Name is required'
  else if (name.length > 80) fields.name = 'Name must be 80 characters or fewer'

  const description = text(input.description)
  if (description === null) fields.description = 'Description is required'
  else if (description.length > 500)
    fields.description = 'Description must be 500 characters or fewer'

  const price = input.priceCents
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 1) {
    fields.priceCents = 'Price must be a positive whole number of cents'
  }

  const categoryId = input.categoryId
  if (typeof categoryId !== 'string' || !categoryExists(categoryId)) {
    fields.categoryId = 'Choose an existing category'
  }

  const imageUrl = input.imageUrl
  if (imageUrl !== null && typeof imageUrl !== 'string')
    fields.imageUrl = 'Image must be a URL or empty'

  const available = input.available
  if (typeof available !== 'boolean') fields.available = 'Availability must be true or false'

  const allergens = input.allergens
  const validAllergens = Array.isArray(allergens) ? allergens.filter(isAllergen) : null
  if (!Array.isArray(allergens) || validAllergens?.length !== allergens.length) {
    fields.allergens = 'Unknown allergen'
  }

  if (
    Object.keys(fields).length > 0 ||
    name === null ||
    description === null ||
    typeof price !== 'number' ||
    typeof categoryId !== 'string' ||
    (imageUrl !== null && typeof imageUrl !== 'string') ||
    typeof available !== 'boolean' ||
    validAllergens === null
  ) {
    return { ok: false, fields }
  }
  return {
    ok: true,
    value: {
      name,
      description,
      priceCents: price,
      categoryId,
      imageUrl: imageUrl === '' ? null : imageUrl,
      available,
      allergens: validAllergens,
    },
  }
}

import type { CartLine } from '@/types/cart'
import type { CreateOrderRequest } from '@/types/api'
import type { Fulfillment } from '@/types/domain'

export interface CheckoutForm {
  name: string
  phone: string
  fulfillment: Fulfillment
  address: string
}

export type CheckoutField = 'name' | 'phone' | 'address'
export type CheckoutErrors = Partial<Record<CheckoutField, string>>

// The same rules the API applies, so most mistakes are caught before a request is made. The server
// stays the authority: whatever it still rejects comes back as 422 and is mapped by `mapServerErrors`.
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

export function validateCheckoutForm(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {}

  if (form.name.trim() === '') errors.name = 'Name is required'

  const phone = form.phone.trim()
  if (phone === '') errors.phone = 'Phone is required'
  else if (!PHONE_PATTERN.test(phone)) errors.phone = 'Phone number looks invalid'

  if (form.fulfillment === 'delivery' && form.address.trim() === '') {
    errors.address = 'Address is required for delivery'
  }
  return errors
}

export function hasErrors(errors: CheckoutErrors): boolean {
  return Object.keys(errors).length > 0
}

export function buildOrderRequest(
  form: CheckoutForm,
  lines: readonly CartLine[],
): CreateOrderRequest {
  const delivery = form.fulfillment === 'delivery'
  return {
    fulfillment: form.fulfillment,
    customer: {
      name: form.name.trim(),
      phone: form.phone.trim(),
      ...(delivery ? { address: form.address.trim() } : {}),
    },
    lines: lines.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      ...(line.note.trim() === '' ? {} : { note: line.note.trim() }),
    })),
  }
}

const FIELD_NAMES: Record<string, CheckoutField> = {
  'customer.name': 'name',
  'customer.phone': 'phone',
  'customer.address': 'address',
}

/**
 * Splits the API's `fields` (name -> message) into the ones that belong to an input and the rest.
 * Problems with the order's lines (`lines.1.quantity`) are about the cart, not the form, so they
 * come back as sentences naming the dish. Anything unknown is passed on as it is, never dropped.
 */
export function mapServerErrors(
  fieldErrors: Readonly<Record<string, string>>,
  lines: readonly CartLine[],
): { fields: CheckoutErrors; general: string[] } {
  const fields: CheckoutErrors = {}
  const general: string[] = []

  for (const [key, message] of Object.entries(fieldErrors)) {
    const field = FIELD_NAMES[key]
    if (field !== undefined) {
      fields[field] = message
      continue
    }
    const index = /^lines\.(\d+)\./.exec(key)?.[1]
    const name = index === undefined ? undefined : lines[Number(index)]?.name
    general.push(name === undefined || message.includes(name) ? message : `${name}: ${message}`)
  }
  return { fields, general }
}

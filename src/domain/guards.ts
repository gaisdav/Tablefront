import {
  ALLERGENS,
  FULFILLMENTS,
  ORDER_STATUSES,
  type Allergen,
  type Fulfillment,
  type OrderStatus,
} from '@/types/domain'

/** A JSON object: not null and not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status === value)
}

export function isFulfillment(value: unknown): value is Fulfillment {
  return FULFILLMENTS.some((fulfillment) => fulfillment === value)
}

export function isAllergen(value: unknown): value is Allergen {
  return ALLERGENS.some((allergen) => allergen === value)
}

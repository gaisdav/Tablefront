import { describe, expect, it } from 'vitest'
import { isApiError } from '@/api/errors'
import { ordersApi } from '@/api/ordersApi'
import { rejection } from '@/test/helpers'
import type { CreateOrderRequest } from '@/types/api'

const customer = { name: 'Eva Braun', phone: '+49 30 9876543' }

function pickupOrder(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    lines: [{ menuItemId: 'item-5', quantity: 2 }],
    fulfillment: 'pickup',
    customer,
    ...overrides,
  }
}

/** Sends an order that should be rejected and returns the field errors. */
async function fieldErrorsFor(request: CreateOrderRequest): Promise<Record<string, string>> {
  const error = await rejection(ordersApi.createOrder(request))
  if (!isApiError(error)) throw new Error('Expected an ApiError')
  expect(error.status).toBe(422)
  return { ...error.fieldErrors }
}

describe('ordersApi.createOrder', () => {
  it('creates a new order with prices and totals taken from the menu', async () => {
    const order = await ordersApi.createOrder(
      pickupOrder({
        lines: [
          { menuItemId: 'item-5', quantity: 2 },
          { menuItemId: 'item-17', quantity: 1, note: 'No ice' },
        ],
      }),
    )

    expect(order).toMatchObject({
      status: 'new',
      fulfillment: 'pickup',
      totalCents: 2 * 1100 + 450,
      customer,
      lines: [
        { menuItemId: 'item-5', name: 'Margherita pizza', unitPriceCents: 1100, quantity: 2 },
        {
          menuItemId: 'item-17',
          name: 'Lemonade',
          unitPriceCents: 450,
          quantity: 1,
          note: 'No ice',
        },
      ],
    })
  })

  it('can be fetched afterwards', async () => {
    const created = await ordersApi.createOrder(pickupOrder())

    expect(await ordersApi.getOrder(created.id)).toEqual(created)
  })

  it('keeps the address for delivery and drops it for pickup', async () => {
    const delivery = await ordersApi.createOrder(
      pickupOrder({
        fulfillment: 'delivery',
        customer: { ...customer, address: 'Hauptstr. 1, 10827 Berlin' },
      }),
    )
    const pickup = await ordersApi.createOrder(
      pickupOrder({ customer: { ...customer, address: 'Ignored' } }),
    )

    expect(delivery.customer.address).toBe('Hauptstr. 1, 10827 Berlin')
    expect(pickup.customer).toEqual(customer)
  })

  it('rejects a phone number made only of separators', async () => {
    const fields = await fieldErrorsFor({
      lines: [{ menuItemId: 'item-5', quantity: 1 }],
      fulfillment: 'pickup',
      customer: { name: 'Anna', phone: '-------' },
    })

    expect(fields).toEqual({ 'customer.phone': 'Phone number looks invalid' })
  })

  it('reports an error per invalid field', async () => {
    const fields = await fieldErrorsFor({
      lines: [],
      fulfillment: 'pickup',
      customer: { name: ' ', phone: 'abc' },
    })

    expect(fields).toEqual({
      'customer.name': 'Name is required',
      'customer.phone': 'Phone number looks invalid',
      lines: 'Add at least one item',
    })
  })

  it('requires an address for delivery only', async () => {
    const fields = await fieldErrorsFor(pickupOrder({ fulfillment: 'delivery' }))

    expect(fields).toEqual({ 'customer.address': 'Address is required for delivery' })
  })

  it('points at the offending line for unknown items, unavailable items and bad quantities', async () => {
    const fields = await fieldErrorsFor(
      pickupOrder({
        lines: [
          { menuItemId: 'item-5', quantity: 1 },
          { menuItemId: 'nope', quantity: 1 },
          { menuItemId: 'item-8', quantity: 1 },
          { menuItemId: 'item-5', quantity: 0 },
        ],
      }),
    )

    expect(fields).toEqual({
      'lines.1.menuItemId': 'Unknown menu item',
      'lines.2.menuItemId': 'Lasagna is no longer available',
      'lines.3.quantity': 'Quantity must be between 1 and 99',
    })
  })

  it('limits the number of lines and the length of a note', async () => {
    const tooManyLines = await fieldErrorsFor(
      pickupOrder({
        lines: Array.from({ length: 31 }, () => ({ menuItemId: 'item-5', quantity: 1 })),
      }),
    )
    const longNote = await fieldErrorsFor(
      pickupOrder({ lines: [{ menuItemId: 'item-5', quantity: 1, note: 'x'.repeat(201) }] }),
    )

    expect(tooManyLines).toEqual({ lines: 'An order can have at most 30 lines' })
    expect(longNote).toEqual({ 'lines.0.note': 'Note must be 200 characters or fewer' })
  })

  it('does not create an order when validation fails', async () => {
    await fieldErrorsFor(pickupOrder({ lines: [] }))

    const error = await rejection(ordersApi.getOrder('ord-1008'))

    expect(error).toMatchObject({ status: 404 })
  })
})

describe('ordersApi.getOrder', () => {
  it('returns a seeded order', async () => {
    const order = await ordersApi.getOrder('ord-1003')

    expect(order).toMatchObject({ id: 'ord-1003', status: 'ready', fulfillment: 'pickup' })
  })

  it('rejects with 404 for an unknown order', async () => {
    const error = await rejection(ordersApi.getOrder('ord-0'))

    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'Order not found' })
  })
})

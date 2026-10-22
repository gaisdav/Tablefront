import { describe, expect, it } from 'vitest'
import {
  buildOrderRequest,
  hasErrors,
  mapServerErrors,
  validateCheckoutForm,
  type CheckoutForm,
} from '@/domain/checkout'
import type { CartLine } from '@/types/cart'

const valid: CheckoutForm = {
  name: 'Anna Keller',
  phone: '+49 30 1234567',
  fulfillment: 'pickup',
  address: '',
}

const lines: CartLine[] = [
  { menuItemId: 'item-5', name: 'Margherita pizza', unitPriceCents: 1100, quantity: 2, note: '' },
  { menuItemId: 'item-17', name: 'Lemonade', unitPriceCents: 450, quantity: 1, note: ' no ice ' },
]

describe('validateCheckoutForm', () => {
  it('accepts a complete pickup order without an address', () => {
    expect(validateCheckoutForm(valid)).toEqual({})
  })

  it.each(['', '   '])('requires a name (%j)', (name) => {
    expect(validateCheckoutForm({ ...valid, name }).name).toBe('Name is required')
  })

  it('requires a phone number', () => {
    expect(validateCheckoutForm({ ...valid, phone: ' ' }).phone).toBe('Phone is required')
  })

  it.each([
    'abc',
    '12345',
    '-------',
    '((((((( ',
    '+ ( ) - 1 2 3',
    '++49 123 4567',
    '123456789012345678901',
    '030/1234567',
  ])('rejects the phone number %j', (phone) => {
    expect(validateCheckoutForm({ ...valid, phone }).phone).toBe('Phone number looks invalid')
  })

  it.each(['+49 30 1234567', '030 1234567', '(030) 123-4567', ' 1234567 '])(
    'accepts the phone number %j',
    (phone) => {
      expect(validateCheckoutForm({ ...valid, phone }).phone).toBeUndefined()
    },
  )

  it('requires an address for delivery only', () => {
    const delivery = { ...valid, fulfillment: 'delivery' as const }

    expect(validateCheckoutForm(delivery).address).toBe('Address is required for delivery')
    expect(validateCheckoutForm({ ...delivery, address: '  ' }).address).toBeDefined()
    expect(validateCheckoutForm({ ...delivery, address: 'Hauptstr. 1' })).toEqual({})
    expect(validateCheckoutForm({ ...valid, address: '' }).address).toBeUndefined()
  })

  it('reports every problem at once', () => {
    const errors = validateCheckoutForm({
      name: '',
      phone: '',
      fulfillment: 'delivery',
      address: '',
    })

    expect(Object.keys(errors).sort()).toEqual(['address', 'name', 'phone'])
    expect(hasErrors(errors)).toBe(true)
    expect(hasErrors({})).toBe(false)
  })
})

describe('buildOrderRequest', () => {
  it('trims text and sends only what the server needs for the lines', () => {
    const request = buildOrderRequest({ ...valid, name: ' Anna Keller ' }, lines)

    expect(request).toEqual({
      fulfillment: 'pickup',
      customer: { name: 'Anna Keller', phone: '+49 30 1234567' },
      lines: [
        { menuItemId: 'item-5', quantity: 2 },
        { menuItemId: 'item-17', quantity: 1, note: 'no ice' },
      ],
    })
  })

  it('includes the address for delivery and leaves a stale one out for pickup', () => {
    const delivery = buildOrderRequest(
      { ...valid, fulfillment: 'delivery', address: ' Hauptstr. 1 ' },
      lines,
    )
    const pickup = buildOrderRequest({ ...valid, address: 'left over from before' }, lines)

    expect(delivery.customer.address).toBe('Hauptstr. 1')
    expect(pickup.customer).not.toHaveProperty('address')
  })
})

describe('mapServerErrors', () => {
  it('puts customer fields on their inputs', () => {
    const { fields, general } = mapServerErrors(
      { 'customer.name': 'Name is required', 'customer.phone': 'Phone number looks invalid' },
      lines,
    )

    expect(fields).toEqual({ name: 'Name is required', phone: 'Phone number looks invalid' })
    expect(general).toEqual([])
  })

  it('turns problems with a line into sentences that name the dish', () => {
    const { fields, general } = mapServerErrors(
      {
        'lines.1.quantity': 'Quantity must be between 1 and 99',
        'lines.0.menuItemId': 'Margherita pizza is no longer available',
      },
      lines,
    )

    expect(fields).toEqual({})
    expect(general).toEqual([
      'Lemonade: Quantity must be between 1 and 99',
      'Margherita pizza is no longer available',
    ])
  })

  it('passes on anything it does not know instead of dropping it', () => {
    const { general } = mapServerErrors(
      { fulfillment: 'Choose pickup or delivery', 'lines.9.quantity': 'Too many' },
      lines,
    )

    expect(general).toEqual(['Choose pickup or delivery', 'Too many'])
  })
})

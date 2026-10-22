import { beforeEach, describe, expect, it } from 'vitest'
import { adminApi } from '@/api/adminApi'
import { isApiError } from '@/api/errors'
import { menuApi } from '@/api/menuApi'
import { rejection, signInAsAdmin, signOut } from '@/test/helpers'
import type { MenuItemInput } from '@/types/api'

const newItem: MenuItemInput = {
  name: 'Caprese salad',
  description: 'Mozzarella, tomato and basil.',
  priceCents: 850,
  categoryId: 'cat-starters',
  imageUrl: null,
  available: true,
  allergens: ['dairy'],
}

describe('adminApi without a session', () => {
  it.each([
    ['listOrders', () => adminApi.listOrders()],
    ['updateOrderStatus', () => adminApi.updateOrderStatus('ord-1006', 'preparing')],
    ['createMenuItem', () => adminApi.createMenuItem(newItem)],
    ['updateMenuItem', () => adminApi.updateMenuItem('item-1', newItem)],
    ['deleteMenuItem', () => adminApi.deleteMenuItem('item-1')],
  ])('%s is rejected with 401', async (_name, call) => {
    const error = await rejection(call())

    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
  })
})

describe('adminApi orders', () => {
  beforeEach(signInAsAdmin)

  it('lists all orders newest first', async () => {
    const orders = await adminApi.listOrders()

    expect(orders.map((order) => order.id)).toEqual([
      'ord-1007',
      'ord-1006',
      'ord-1005',
      'ord-1004',
      'ord-1003',
      'ord-1002',
      'ord-1001',
    ])
  })

  it('filters by status', async () => {
    const orders = await adminApi.listOrders({ status: 'preparing' })

    expect(orders.map((order) => order.id)).toEqual(['ord-1005', 'ord-1004'])
  })

  it('moves an order along an allowed transition and persists it', async () => {
    const updated = await adminApi.updateOrderStatus('ord-1006', 'preparing')
    const preparing = await adminApi.listOrders({ status: 'preparing' })

    expect(updated).toMatchObject({ id: 'ord-1006', status: 'preparing' })
    expect(preparing.map((order) => order.id)).toContain('ord-1006')
  })

  it.each([
    ['skipping a step', 'ord-1006', 'ready'],
    ['going backwards', 'ord-1005', 'new'],
    ['cancelling a ready order', 'ord-1003', 'cancelled'],
    ['reopening a completed order', 'ord-1001', 'preparing'],
  ] as const)('rejects %s with 409 and leaves the order unchanged', async (_label, id, status) => {
    const before = (await adminApi.listOrders()).find((order) => order.id === id)

    const error = await rejection(adminApi.updateOrderStatus(id, status))
    const after = (await adminApi.listOrders()).find((order) => order.id === id)

    expect(error).toMatchObject({ status: 409, code: 'invalid_transition' })
    expect(after?.status).toBe(before?.status)
  })

  it('rejects with 404 for an unknown order', async () => {
    const error = await rejection(adminApi.updateOrderStatus('ord-0', 'preparing'))

    expect(error).toMatchObject({ status: 404, code: 'not_found' })
  })
})

describe('adminApi menu items', () => {
  beforeEach(signInAsAdmin)

  it('creates an item that guests can then see', async () => {
    const created = await adminApi.createMenuItem(newItem)
    const guestItems = await menuApi.listMenuItems({ q: 'caprese' })

    expect(created).toMatchObject(newItem)
    expect(created.id).toMatch(/^item-/)
    expect(guestItems).toEqual([created])
  })

  it('treats an empty image as no image', async () => {
    const created = await adminApi.createMenuItem({ ...newItem, imageUrl: '' })

    expect(created.imageUrl).toBeNull()
  })

  it('reports field errors for invalid input', async () => {
    const error = await rejection(
      adminApi.createMenuItem({
        ...newItem,
        name: '  ',
        priceCents: 10.5,
        categoryId: 'cat-unknown',
      }),
    )

    if (!isApiError(error)) throw new Error('Expected an ApiError')
    expect(error.status).toBe(422)
    expect({ ...error.fieldErrors }).toEqual({
      name: 'Name is required',
      priceCents: 'Price must be a positive whole number of cents',
      categoryId: 'Choose an existing category',
    })
  })

  it('updates an item', async () => {
    const updated = await adminApi.updateMenuItem('item-1', {
      ...newItem,
      name: 'Bruschetta classica',
    })
    const items = await menuApi.listMenuItems({ q: 'classica' })

    expect(updated).toMatchObject({ id: 'item-1', name: 'Bruschetta classica' })
    expect(items).toEqual([updated])
  })

  it('hides an item from guests once it is marked unavailable', async () => {
    await adminApi.updateMenuItem('item-1', { ...newItem, name: 'Bruschetta', available: false })
    signOut()

    const guestItems = await menuApi.listMenuItems({ q: 'bruschetta' })

    expect(guestItems).toEqual([])
  })

  it('rejects an update with 404 for an unknown item and 422 for invalid input', async () => {
    const missing = await rejection(adminApi.updateMenuItem('item-0', newItem))
    const invalid = await rejection(adminApi.updateMenuItem('item-1', { ...newItem, name: '' }))

    expect(missing).toMatchObject({ status: 404 })
    expect(invalid).toMatchObject({ status: 422, fieldErrors: { name: 'Name is required' } })
  })

  it('deletes an item, and a second delete is a 404', async () => {
    await expect(adminApi.deleteMenuItem('item-1')).resolves.toBeUndefined()

    const items = await menuApi.listMenuItems({ q: 'bruschetta' })
    const error = await rejection(adminApi.deleteMenuItem('item-1'))

    expect(items).toEqual([])
    expect(error).toMatchObject({ status: 404, code: 'not_found' })
  })
})

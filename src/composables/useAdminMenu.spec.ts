import { createPinia, setActivePinia } from 'pinia'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminMenu } from '@/composables/useAdminMenu'
import { db } from '@/mocks/db'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { useToastsStore } from '@/stores/toasts'
import { signInAsAdmin } from '@/test/helpers'
import type { MenuItemInput } from '@/types/api'

const scopes: EffectScope[] = []

function menu() {
  setActivePinia(createPinia())
  const scope = effectScope()
  scopes.push(scope)
  const result = scope.run(() => useAdminMenu())
  if (result === undefined) throw new Error('scope did not run')
  return { ...result, toasts: useToastsStore() }
}

async function loaded(result: ReturnType<typeof menu>) {
  await vi.waitFor(() => {
    expect(result.items.value).toBeDefined()
    expect(result.categories.value.length).toBeGreaterThan(0)
  })
}

const dish = menuItems.find((item) => item.available)
const soldOut = menuItems.find((item) => !item.available)
if (dish === undefined || soldOut === undefined) throw new Error('fixtures need both kinds of dish')

const input: MenuItemInput = {
  name: 'Zimtschnecke',
  description: 'Warm, with vanilla sauce.',
  priceCents: 650,
  categoryId: 'cat-desserts',
  imageUrl: null,
  available: true,
  allergens: ['gluten'],
}

const availableOf = (result: ReturnType<typeof menu>, id: string) =>
  result.items.value?.find((item) => item.id === id)?.available

beforeEach(async () => {
  await signInAsAdmin()
})

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

describe('useAdminMenu: loading', () => {
  it('loads every dish, the sold-out ones too, and the categories', async () => {
    const result = menu()

    await loaded(result)

    expect(result.items.value).toHaveLength(menuItems.length)
    expect(result.items.value?.some((item) => !item.available)).toBe(true)
    expect(result.categories.value.length).toBeGreaterThan(0)
  })

  it('reports a failure to load, and loads again on request', async () => {
    server.use(
      mswHttp.get('/api/menu-items', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const result = menu()
    await vi.waitFor(() => {
      expect(result.error.value?.message).toBe('Down')
    })

    server.resetHandlers()
    result.reload()

    await vi.waitFor(() => {
      expect(result.items.value).toHaveLength(menuItems.length)
    })
    expect(result.error.value).toBeNull()
  })
})

describe('useAdminMenu: the availability switch', () => {
  it('applies the change at once and keeps it when the server agrees', async () => {
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', async () => {
        await delay(60)
        return undefined
      }),
    )
    const result = menu()
    await loaded(result)

    const saving = result.setAvailable(dish.id, false)

    expect(availableOf(result, dish.id)).toBe(false)
    expect(result.saving.has(dish.id)).toBe(true)
    await saving
    expect(result.saving.has(dish.id)).toBe(false)
    expect(availableOf(result, dish.id)).toBe(false)
    expect(db.getMenuItem(dish.id)?.available).toBe(false)
    expect(result.toasts.toasts[0]?.message).toBe(`${dish.name} is now sold out.`)
  })

  it('sends the whole dish, changed only in availability', async () => {
    let body: unknown
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', async ({ request }) => {
        body = await request.clone().json()
        return undefined
      }),
    )
    const result = menu()
    await loaded(result)

    await result.setAvailable(soldOut.id, true)

    expect(body).toEqual({
      name: soldOut.name,
      description: soldOut.description,
      priceCents: soldOut.priceCents,
      categoryId: soldOut.categoryId,
      imageUrl: soldOut.imageUrl,
      available: true,
      allergens: soldOut.allergens,
    })
  })

  it('undoes the change and says why when the server refuses', async () => {
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', () =>
        HttpResponse.json(
          { error: { code: 'server_error', message: 'Kitchen is down' } },
          { status: 500 },
        ),
      ),
    )
    const result = menu()
    await loaded(result)

    const saving = result.setAvailable(dish.id, false)
    expect(availableOf(result, dish.id)).toBe(false)
    await saving

    expect(availableOf(result, dish.id)).toBe(true)
    expect(result.toasts.toasts[0]?.kind).toBe('error')
    expect(result.toasts.toasts[0]?.message).toContain('Kitchen is down')
    expect(result.saving.has(dish.id)).toBe(false)
  })

  it('undoes the change when the network fails', async () => {
    server.use(mswHttp.put('/api/admin/menu-items/:id', () => HttpResponse.error()))
    const result = menu()
    await loaded(result)

    await result.setAvailable(dish.id, false)

    expect(availableOf(result, dish.id)).toBe(true)
  })

  it('stays quiet about a 401: the user is already being taken to the login page', async () => {
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', () =>
        HttpResponse.json({ error: { code: 'unauthorized', message: 'No' } }, { status: 401 }),
      ),
    )
    const result = menu()
    await loaded(result)

    await result.setAvailable(dish.id, false)

    expect(availableOf(result, dish.id)).toBe(true)
    expect(result.toasts.toasts).toEqual([])
  })

  it('ignores a second change to the same dish while one is on its way', async () => {
    let requests = 0
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', async () => {
        requests += 1
        await delay(60)
        return undefined
      }),
    )
    const result = menu()
    await loaded(result)

    const first = result.setAvailable(dish.id, false)
    await result.setAvailable(dish.id, true)
    await first

    expect(requests).toBe(1)
    expect(availableOf(result, dish.id)).toBe(false)
  })

  it('does nothing for a dish that is not there, or for no change', async () => {
    let requests = 0
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', () => {
        requests += 1
        return undefined
      }),
    )
    const result = menu()
    await loaded(result)

    await result.setAvailable('item-nope', true)
    await result.setAvailable(dish.id, true) // already available

    expect(requests).toBe(0)
  })
})

describe('useAdminMenu: saving', () => {
  it('creates a dish and puts it with its category', async () => {
    const result = menu()
    await loaded(result)

    const outcome = await result.save(input)

    expect(outcome.ok).toBe(true)
    const created = result.items.value?.find((item) => item.name === 'Zimtschnecke')
    expect(created?.id).toBeDefined()
    expect(db.getMenuItem(created?.id ?? '')?.name).toBe('Zimtschnecke')
    const inCategory =
      result.items.value?.filter((item) => item.categoryId === 'cat-desserts') ?? []
    expect(inCategory.at(-1)?.id).toBe(created?.id) // added last within its category
    // Grouped by category: each category appears as one run, not scattered.
    const runs = (result.items.value ?? [])
      .map((item) => item.categoryId)
      .filter((id, index, all) => id !== all[index - 1])
    expect(new Set(runs).size).toBe(runs.length)
  })

  it('saves changes to an existing dish', async () => {
    const result = menu()
    await loaded(result)

    const outcome = await result.save(
      { ...input, name: 'Renamed', categoryId: dish.categoryId },
      dish.id,
    )

    expect(outcome.ok && outcome.item.id).toBe(dish.id)
    expect(result.items.value?.filter((item) => item.id === dish.id)).toHaveLength(1)
    expect(result.items.value?.find((item) => item.id === dish.id)?.name).toBe('Renamed')
  })

  it('returns the API field errors, with names the form understands, and changes nothing', async () => {
    const result = menu()
    await loaded(result)
    server.use(
      mswHttp.post('/api/admin/menu-items', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: 'Invalid',
              fields: {
                name: 'Name is required',
                priceCents: 'Price must be a positive whole number of cents',
              },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const before = result.items.value?.length

    const outcome = await result.save(input)

    expect(outcome).toEqual({
      ok: false,
      fields: { name: 'Name is required', price: 'Price must be a positive whole number of cents' },
      general: [],
    })
    expect(result.items.value).toHaveLength(before ?? -1)
  })

  it('returns a message for any other failure', async () => {
    const result = menu()
    await loaded(result)
    server.use(
      mswHttp.post('/api/admin/menu-items', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )

    expect(await result.save(input)).toEqual({ ok: false, fields: {}, general: ['Down'] })
  })

  it('returns nothing to show for a 401', async () => {
    const result = menu()
    await loaded(result)
    server.use(
      mswHttp.post('/api/admin/menu-items', () =>
        HttpResponse.json({ error: { code: 'unauthorized', message: 'No' } }, { status: 401 }),
      ),
    )

    expect(await result.save(input)).toEqual({ ok: false, fields: {}, general: [] })
  })

  it('does not throw when the network fails', async () => {
    const result = menu()
    await loaded(result)
    server.use(mswHttp.post('/api/admin/menu-items', () => HttpResponse.error()))

    const outcome = await result.save(input)

    expect(outcome.ok).toBe(false)
  })
})

describe('useAdminMenu: deleting', () => {
  it('removes the dish and says so', async () => {
    const result = menu()
    await loaded(result)

    const gone = await result.remove(dish.id)

    expect(gone).toBe(true)
    expect(result.items.value?.some((item) => item.id === dish.id)).toBe(false)
    expect(db.getMenuItem(dish.id)).toBeUndefined()
    expect(result.toasts.toasts[0]?.message).toBe(`${dish.name} was deleted.`)
  })

  it('counts a dish that was already gone as deleted, and brings the list in line', async () => {
    const result = menu()
    await loaded(result)
    db.deleteMenuItem(dish.id) // removed elsewhere

    const gone = await result.remove(dish.id)

    expect(gone).toBe(true)
    expect(result.items.value?.some((item) => item.id === dish.id)).toBe(false)
  })

  it('keeps the dish and says why when the server refuses', async () => {
    const result = menu()
    await loaded(result)
    server.use(
      mswHttp.delete('/api/admin/menu-items/:id', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )

    const gone = await result.remove(dish.id)

    expect(gone).toBe(false)
    expect(result.items.value?.some((item) => item.id === dish.id)).toBe(true)
    expect(result.toasts.toasts[0]?.kind).toBe('error')
  })
})

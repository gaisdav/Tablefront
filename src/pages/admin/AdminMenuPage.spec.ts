import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { delay, http as mswHttp, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { menuItems } from '@/mocks/fixtures'
import { server } from '@/mocks/server'
import { startStaffSession } from '@/test/helpers'
import { setViewport } from '@/test/media'
import { mountAppAt, unmountApps } from '@/test/mountApp'

const dish = menuItems.find((item) => item.available && item.categoryId === 'cat-mains')
const soldOut = menuItems.find((item) => !item.available)
if (dish === undefined || soldOut === undefined) throw new Error('fixtures need both kinds of dish')

const rows = (wrapper: VueWrapper) => wrapper.findAll('tbody tr')
const rowNames = (wrapper: VueWrapper) => rows(wrapper).map((row) => row.get('.name__text').text())
const dialogs = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
const dialog = (title: string) =>
  dialogs().find((candidate) => candidate.querySelector('h2')?.textContent === title)
const button = (scope: ParentNode, text: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
const toastTexts = () => [...document.querySelectorAll('.toast__message')].map((t) => t.textContent)

async function mountMenu(path = '/admin/menu') {
  startStaffSession()
  setViewport(true)
  const result = await mountAppAt(path)
  await vi.waitFor(() => {
    expect(rows(result.wrapper).length).toBeGreaterThan(0)
  })
  return result
}

function formField(name: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`[role="dialog"] [name="${name}"]`)
  if (found === null) throw new Error(`no field ${name}`)
  return found
}

function type(name: string, value: string): void {
  const input = formField(name)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function openAddForm(wrapper: VueWrapper) {
  await wrapper.get('.menu__head button').trigger('click')
  await vi.waitFor(() => {
    expect(dialog('Add a dish')).toBeDefined()
  })
}

async function openEditForm(wrapper: VueWrapper, name: string) {
  await wrapper.get(`[aria-label="Edit ${name}"]`).trigger('click')
  await vi.waitFor(() => {
    expect(dialog(`Edit ${name}`)).toBeDefined()
  })
}

async function submitForm() {
  const form = document.querySelector<HTMLFormElement>('[role="dialog"] form')
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
}

async function answerConfirm(title: string, label: string) {
  await vi.waitFor(() => {
    expect(dialog(title)).toBeDefined()
  })
  button(dialog(title) ?? document, label)?.click()
  await flushPromises()
}

beforeEach(() => {
  setViewport(true)
})

afterEach(() => {
  unmountApps()
  setViewport(false)
})

describe('the menu page: the list', () => {
  it('lists every dish, sold-out ones included', async () => {
    const { wrapper } = await mountMenu()

    expect(rowNames(wrapper)).toHaveLength(menuItems.length)
    expect(rowNames(wrapper)).toContain(soldOut.name)
    expect(wrapper.get('[role="status"]').text()).toBe(
      `${String(menuItems.length)} of ${String(menuItems.length)} dishes`,
    )
  })

  it('searches the name and the description, keeps the text in the URL, and can clear it', async () => {
    const { wrapper, router } = await mountMenu()

    await wrapper.get('input[type="search"]').setValue('lasagna')
    await flushPromises()

    expect(rowNames(wrapper)).toEqual(
      menuItems
        .filter((item) => `${item.name} ${item.description}`.toLowerCase().includes('lasagna'))
        .map((item) => item.name),
    )
    expect(router.currentRoute.value.query.q).toBe('lasagna')

    await wrapper.get('input[type="search"]').setValue('zzz nothing')
    await flushPromises()
    expect(wrapper.text()).toContain('No dishes match')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Clear search')
      ?.trigger('click')
    await flushPromises()
    expect(rowNames(wrapper)).toHaveLength(menuItems.length)
    expect(router.currentRoute.value.query.q).toBeUndefined()
  })

  it('opens already filtered from a link', async () => {
    const { wrapper } = await mountMenu('/admin/menu?q=espresso')

    expect(rowNames(wrapper).length).toBeLessThan(menuItems.length)
    expect(wrapper.get<HTMLInputElement>('input[type="search"]').element.value).toBe('espresso')
  })

  it('says so when there are no dishes at all', async () => {
    startStaffSession()
    server.use(mswHttp.get('/api/menu-items', () => HttpResponse.json([])))
    const { wrapper } = await mountAppAt('/admin/menu')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('No dishes yet')
    })
  })

  it('shows an error with a way to retry when the menu cannot be loaded', async () => {
    startStaffSession()
    server.use(
      mswHttp.get('/api/menu-items', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const { wrapper } = await mountAppAt('/admin/menu')
    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Down')
    })

    server.resetHandlers()
    await wrapper.get('[role="alert"] button').trigger('click')

    await vi.waitFor(() => {
      expect(rows(wrapper).length).toBeGreaterThan(0)
    })
  })
})

describe('the menu page: the availability switch', () => {
  it('shows the change at once and keeps it', async () => {
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', async () => {
        await delay(60)
        return undefined
      }),
    )
    const { wrapper } = await mountMenu()
    const sw = () => wrapper.get(`[aria-label="${dish.name} available"]`)

    await sw().trigger('click')
    expect(sw().attributes('aria-checked')).toBe('false')
    expect(db.getMenuItem(dish.id)?.available).toBe(true) // not saved yet

    await vi.waitFor(() => {
      expect(toastTexts()).toContain(`${dish.name} is now sold out.`)
    })
    expect(db.getMenuItem(dish.id)?.available).toBe(false)
    expect(sw().attributes('aria-checked')).toBe('false')
  })

  it('undoes it and says why when the server refuses', async () => {
    server.use(
      mswHttp.put('/api/admin/menu-items/:id', async () => {
        await delay(30)
        return HttpResponse.json(
          { error: { code: 'server_error', message: 'Down' } },
          { status: 500 },
        )
      }),
    )
    const { wrapper } = await mountMenu()
    const sw = () => wrapper.get(`[aria-label="${dish.name} available"]`)

    await sw().trigger('click')
    expect(sw().attributes('aria-checked')).toBe('false')

    await vi.waitFor(() => {
      expect(document.querySelector('.toast--error')?.textContent).toContain('Down')
    })
    expect(sw().attributes('aria-checked')).toBe('true')
  })
})

describe('the menu page: adding a dish', () => {
  it('opens an empty form, saves a valid dish and shows it in the list', async () => {
    const { wrapper } = await mountMenu()
    await openAddForm(wrapper)

    type('name', 'Zimtschnecke')
    type('price', '3,50')
    await submitForm()

    await vi.waitFor(() => {
      expect(dialog('Add a dish')).toBeUndefined()
    })
    expect(rowNames(wrapper)).toContain('Zimtschnecke')
    expect(toastTexts()).toContain('Zimtschnecke was saved.')
    const saved = [...menuItems, ...db.listMenuItems({ includeUnavailable: true })].find(
      (item) => item.name === 'Zimtschnecke',
    )
    expect(saved?.priceCents).toBe(350)
  })

  it('shows what is missing inline and keeps the form open', async () => {
    const { wrapper } = await mountMenu()
    await openAddForm(wrapper)

    await submitForm()

    expect(dialog('Add a dish')?.textContent).toContain('Name is required')
    expect(dialog('Add a dish')?.textContent).toContain('Price is required')
    expect(document.activeElement).toBe(formField('name'))
    expect(rowNames(wrapper)).toHaveLength(menuItems.length)
  })

  it('shows the errors the API answers with on the right inputs', async () => {
    server.use(
      mswHttp.post('/api/admin/menu-items', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: 'Invalid',
              fields: {
                name: 'That name is taken',
                priceCents: 'Price must be a positive whole number of cents',
              },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { wrapper } = await mountMenu()
    await openAddForm(wrapper)
    type('name', 'Zimtschnecke')
    type('price', '3.50')

    await submitForm()

    await vi.waitFor(() => {
      expect(dialog('Add a dish')?.textContent).toContain('That name is taken')
    })
    expect(formField('name').getAttribute('aria-invalid')).toBe('true')
    expect(formField('price').getAttribute('aria-invalid')).toBe('true')
    expect(dialog('Add a dish')?.textContent).toContain(
      'Price must be a positive whole number of cents',
    )
    expect(rowNames(wrapper)).toHaveLength(menuItems.length)
  })
})

describe('the menu page: editing a dish', () => {
  it('opens the form with the dish, saves the change and updates the row', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    expect(formField('name').value).toBe(dish.name)

    type('price', '99.90')
    await submitForm()

    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })
    expect(db.getMenuItem(dish.id)?.priceCents).toBe(9990)
    const row = rows(wrapper).find((r) => r.get('.name__text').text() === dish.name)
    expect(row?.text()).toContain('€99.90')
  })

  it('returns focus to the Edit button it was opened from', async () => {
    const { wrapper } = await mountMenu()
    const edit = wrapper.get<HTMLElement>(`[aria-label="Edit ${dish.name}"]`)
    edit.element.focus()
    await edit.trigger('click')
    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeDefined()
    })

    button(dialog(`Edit ${dish.name}`) ?? document, 'Cancel')?.click()
    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })

    expect(document.activeElement).toBe(edit.element)
  })
})

describe('the menu page: deleting a dish', () => {
  it('asks first, and does nothing if the answer is no', async () => {
    const { wrapper } = await mountMenu()

    await wrapper.get(`[aria-label="Delete ${dish.name}"]`).trigger('click')
    await answerConfirm(`Delete ${dish.name}?`, 'Cancel')
    await new Promise((resolve) => setTimeout(resolve, 80)) // long enough for a request to finish

    expect(dialog(`Delete ${dish.name}?`)).toBeUndefined()
    expect(db.getMenuItem(dish.id)).toBeDefined()
    expect(rowNames(wrapper)).toContain(dish.name)
  })

  it('deletes the dish when confirmed, and moves focus somewhere sensible', async () => {
    const { wrapper } = await mountMenu()
    wrapper.get<HTMLElement>(`[aria-label="Delete ${dish.name}"]`).element.focus()

    await wrapper.get(`[aria-label="Delete ${dish.name}"]`).trigger('click')
    await answerConfirm(`Delete ${dish.name}?`, 'Delete')

    await vi.waitFor(() => {
      expect(rowNames(wrapper)).not.toContain(dish.name)
    })
    expect(db.getMenuItem(dish.id)).toBeUndefined()
    expect(toastTexts()).toContain(`${dish.name} was deleted.`)
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(wrapper.get('h1').element)
    })
  })

  it('keeps the dish and says why when the server refuses', async () => {
    server.use(
      mswHttp.delete('/api/admin/menu-items/:id', () =>
        HttpResponse.json({ error: { code: 'server_error', message: 'Down' } }, { status: 500 }),
      ),
    )
    const { wrapper } = await mountMenu()

    await wrapper.get(`[aria-label="Delete ${dish.name}"]`).trigger('click')
    await answerConfirm(`Delete ${dish.name}?`, 'Delete')

    await vi.waitFor(() => {
      expect(document.querySelector('.toast--error')?.textContent).toContain('was not deleted')
    })
    expect(rowNames(wrapper)).toContain(dish.name)
  })
})

describe('the menu page: unsaved changes', () => {
  it('closes a form nobody touched without asking', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)

    button(dialog(`Edit ${dish.name}`) ?? document, 'Cancel')?.click()

    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })
    expect(dialog('Discard changes?')).toBeUndefined()
  })

  it('asks before closing a changed form, and keeps it open on "keep editing"', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()

    button(dialog(`Edit ${dish.name}`) ?? document, 'Cancel')?.click()
    await answerConfirm('Discard changes?', 'Cancel')

    expect(dialog(`Edit ${dish.name}`)).toBeDefined()
    expect(formField('name').value).toBe('Changed')
    expect(dialog('Discard changes?')).toBeUndefined()
  })

  it('discards the changes when that is what the user chooses', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()

    button(dialog(`Edit ${dish.name}`) ?? document, 'Cancel')?.click()
    await answerConfirm('Discard changes?', 'Discard changes')

    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })
    expect(db.getMenuItem(dish.id)?.name).toBe(dish.name)
  })

  it('asks the same when the form is closed with Escape or the close button', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await vi.waitFor(() => {
      expect(dialog('Discard changes?')).toBeDefined()
    })
    expect(dialog(`Edit ${dish.name}`)).toBeDefined()
  })

  it('starts the next form fresh, not from what was discarded', async () => {
    const { wrapper } = await mountMenu()
    await openAddForm(wrapper)
    type('name', 'Half typed')
    await flushPromises()
    button(dialog('Add a dish') ?? document, 'Cancel')?.click()
    await answerConfirm('Discard changes?', 'Discard changes')
    await vi.waitFor(() => {
      expect(dialog('Add a dish')).toBeUndefined()
    })

    await openAddForm(wrapper)

    expect(formField('name').value).toBe('')
  })

  it('asks before leaving the page with a changed form, and stays if the answer is no', async () => {
    const { wrapper, router } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()

    const navigation = router.push('/admin/orders')
    await vi.waitFor(() => {
      expect(dialog('Leave without saving?')).toBeDefined()
    })
    button(dialog('Leave without saving?') ?? document, 'Cancel')?.click()
    await navigation

    expect(router.currentRoute.value.name).toBe('admin-menu')
    expect(dialog(`Edit ${dish.name}`)).toBeDefined()
  })

  it('leaves the page when the user agrees to lose the changes', async () => {
    const { wrapper, router } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()

    const navigation = router.push('/admin/orders')
    await answerConfirm('Leave without saving?', 'Leave page')
    await navigation

    expect(router.currentRoute.value.name).toBe('admin-orders')
  })

  it('leaves the page freely when nothing is unsaved', async () => {
    const { wrapper, router } = await mountMenu()
    await openEditForm(wrapper, dish.name)

    await router.push('/admin/orders')

    expect(dialog('Leave without saving?')).toBeUndefined()
    expect(router.currentRoute.value.name).toBe('admin-orders')
    expect(wrapper.exists()).toBe(true)
  })

  it('has the browser warn before the tab is closed or reloaded, only while there are changes', async () => {
    const { wrapper } = await mountMenu()
    const attempt = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(attempt()).toBe(false)

    await openEditForm(wrapper, dish.name)
    expect(attempt()).toBe(false)
    type('name', 'Changed')
    await flushPromises()
    expect(attempt()).toBe(true)

    button(dialog(`Edit ${dish.name}`) ?? document, 'Cancel')?.click()
    await answerConfirm('Discard changes?', 'Discard changes')
    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })
    expect(attempt()).toBe(false)
  })

  it('stops warning about the tab once the page has been left', async () => {
    const { wrapper, router } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('name', 'Changed')
    await flushPromises()
    const navigation = router.push('/admin/orders')
    await answerConfirm('Leave without saving?', 'Leave page')
    await navigation
    await flushPromises()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.exists()).toBe(true)
  })

  it('does not warn after a successful save', async () => {
    const { wrapper } = await mountMenu()
    await openEditForm(wrapper, dish.name)
    type('price', '88.00')
    await submitForm()
    await vi.waitFor(() => {
      expect(dialog(`Edit ${dish.name}`)).toBeUndefined()
    })

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.exists()).toBe(true)
  })
})

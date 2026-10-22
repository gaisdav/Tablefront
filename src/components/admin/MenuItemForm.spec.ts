import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MenuItemForm from '@/components/admin/MenuItemForm.vue'
import type { SaveResult } from '@/composables/useAdminMenu'
import type { Category, MenuItem } from '@/types/domain'

const categories: Category[] = [
  { id: 'cat-starters', name: 'Starters', sortOrder: 1 },
  { id: 'cat-desserts', name: 'Desserts', sortOrder: 3 },
]

const item: MenuItem = {
  id: 'item-5',
  name: 'Margherita pizza',
  description: 'Tomato and basil.',
  priceCents: 1150,
  categoryId: 'cat-starters',
  imageUrl: null,
  available: true,
  allergens: ['dairy'],
}

type Save = (...args: Parameters<typeof savedOk>) => Promise<SaveResult>
function savedOk(): Promise<SaveResult> {
  return Promise.resolve({ ok: true, item })
}

function mountForm(options: { item?: MenuItem; save?: Save } = {}) {
  const save = vi.fn(options.save ?? savedOk)
  const wrapper = mount(MenuItemForm, {
    props: { item: options.item, categories, save },
    attachTo: document.body,
  })
  return { wrapper, save }
}

const field = (wrapper: ReturnType<typeof mountForm>['wrapper'], name: string) =>
  wrapper.get<HTMLInputElement>(`[name="${name}"]`)
const submit = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
  wrapper.get('form').trigger('submit')
const errors = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
  wrapper.findAll('.field__error').map((e) => e.text())

async function fillValid(wrapper: ReturnType<typeof mountForm>['wrapper']) {
  await field(wrapper, 'name').setValue('Zimtschnecke')
  await field(wrapper, 'price').setValue('3,50')
}

describe('MenuItemForm: a new dish', () => {
  it('starts empty, with the first category and "available" ticked', () => {
    const { wrapper } = mountForm()

    expect(field(wrapper, 'name').element.value).toBe('')
    expect(field(wrapper, 'categoryId').element.value).toBe('cat-starters')
    expect(
      wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').at(-1)?.element.checked,
    ).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Add dish')
    wrapper.unmount()
  })

  it('sends what was entered, with the price in cents', async () => {
    const { wrapper, save } = mountForm()
    await fillValid(wrapper)
    await field(wrapper, 'categoryId').setValue('cat-desserts')
    await wrapper.findAll('input[type="checkbox"]')[0]?.setValue(true) // the first allergen: gluten

    await submit(wrapper)

    expect(save).toHaveBeenCalledWith(
      {
        name: 'Zimtschnecke',
        description: '',
        priceCents: 350,
        categoryId: 'cat-desserts',
        imageUrl: null,
        available: true,
        allergens: ['gluten'],
      },
      undefined,
    )
    wrapper.unmount()
  })

  it('tells its owner when it has been saved', async () => {
    const { wrapper } = mountForm()
    await fillValid(wrapper)

    await submit(wrapper)
    await flushPromises()

    expect(wrapper.emitted('saved')).toEqual([[item]])
    wrapper.unmount()
  })
})

describe('MenuItemForm: an existing dish', () => {
  it('starts from the dish and sends its id along with the changes', async () => {
    const { wrapper, save } = mountForm({ item })
    expect(field(wrapper, 'name').element.value).toBe('Margherita pizza')
    expect(field(wrapper, 'price').element.value).toBe('11.50')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Save changes')

    await field(wrapper, 'price').setValue('12')
    await submit(wrapper)

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 1200 }), 'item-5')
    wrapper.unmount()
  })
})

describe('MenuItemForm: validation', () => {
  it('shows every problem inline, focuses the first, and sends nothing', async () => {
    const { wrapper, save } = mountForm()

    await submit(wrapper)

    expect(errors(wrapper)).toEqual(['Name is required', 'Price is required'])
    expect(field(wrapper, 'name').attributes('aria-invalid')).toBe('true')
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field(wrapper, 'name').element)
    })
    expect(save).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not nag before the first attempt, then clears each message as it is fixed', async () => {
    const { wrapper } = mountForm()
    await field(wrapper, 'name').setValue('a')
    await field(wrapper, 'name').setValue('')
    expect(errors(wrapper)).toEqual([])

    await submit(wrapper)
    expect(errors(wrapper)).toHaveLength(2)

    await field(wrapper, 'name').setValue('Zimtschnecke')
    expect(errors(wrapper)).toEqual(['Price is required'])
    await field(wrapper, 'price').setValue('3.5')
    expect(errors(wrapper)).toEqual([])
    wrapper.unmount()
  })

  it('rejects a price that is not money', async () => {
    const { wrapper } = mountForm()
    await field(wrapper, 'name').setValue('Zimtschnecke')
    await field(wrapper, 'price').setValue('three')

    await submit(wrapper)

    expect(errors(wrapper)).toEqual(['Enter a price like 11.50'])
    wrapper.unmount()
  })

  it('rejects an image address that is not http(s)', async () => {
    const { wrapper } = mountForm()
    await fillValid(wrapper)
    await field(wrapper, 'imageUrl').setValue('example.test/a.jpg')

    await submit(wrapper)

    expect(errors(wrapper)).toEqual(['Use an http(s) address, or leave it empty'])
    wrapper.unmount()
  })
})

describe('MenuItemForm: limits', () => {
  it('stops typing at the length the API allows, for the name and the description', () => {
    const { wrapper } = mountForm()

    expect(field(wrapper, 'name').attributes('maxlength')).toBe('80')
    expect(field(wrapper, 'description').attributes('maxlength')).toBe('500')
    wrapper.unmount()
  })

  it('refuses a huge image address, and accepts the inline image an existing dish may have', async () => {
    const { wrapper } = mountForm()
    await fillValid(wrapper)
    await field(wrapper, 'imageUrl').setValue(`https://example.test/${'a'.repeat(2000)}`)

    await submit(wrapper)
    expect(errors(wrapper)).toEqual(['Keep the address under 2000 characters'])

    await field(wrapper, 'imageUrl').setValue('data:image/svg+xml,%3Csvg%2F%3E')
    expect(errors(wrapper)).toEqual([])
    wrapper.unmount()
  })
})

describe('MenuItemForm: answers from the server', () => {
  it('clears a server error on the allergens when they are changed', async () => {
    const { wrapper } = mountForm({
      save: () =>
        Promise.resolve({ ok: false, fields: { allergens: 'Unknown allergen' }, general: [] }),
    })
    await fillValid(wrapper)
    await submit(wrapper)
    await flushPromises()
    expect(wrapper.get('.allergens__error').text()).toBe('Unknown allergen')
    expect(wrapper.get('fieldset').attributes('aria-invalid')).toBe('true')

    await wrapper.findAll('input[type="checkbox"]')[1]?.setValue(true)

    expect(wrapper.find('.allergens__error').exists()).toBe(false)
    expect(wrapper.get('fieldset').attributes('aria-invalid')).toBeUndefined()
    wrapper.unmount()
  })

  it('puts a field error on its input, focuses it, and lets the user fix and send again', async () => {
    let attempts = 0
    const { wrapper, save } = mountForm({
      save: () => {
        attempts += 1
        return Promise.resolve(
          attempts === 1
            ? {
                ok: false,
                fields: { price: 'Price must be a positive whole number of cents' },
                general: [],
              }
            : { ok: true, item },
        )
      },
    })
    await fillValid(wrapper)

    await submit(wrapper)
    await flushPromises()

    expect(errors(wrapper)).toEqual(['Price must be a positive whole number of cents'])
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field(wrapper, 'price').element)
    })

    await field(wrapper, 'price').setValue('3.60')
    expect(errors(wrapper)).toEqual([])
    await submit(wrapper)
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows a failure that belongs to no field in an alert, and keeps what was typed', async () => {
    const { wrapper } = mountForm({
      save: () => Promise.resolve({ ok: false, fields: {}, general: ['Kitchen is down'] }),
    })
    await fillValid(wrapper)

    await submit(wrapper)
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Kitchen is down')
    expect(field(wrapper, 'name').element.value).toBe('Zimtschnecke')
    expect(wrapper.emitted('saved')).toBeUndefined()
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(alert.element)
    })
    wrapper.unmount()
  })

  it('sends once however often it is submitted while waiting', async () => {
    let finish: () => void = () => undefined
    const { wrapper, save } = mountForm({
      save: () =>
        new Promise<SaveResult>((resolve) => {
          finish = () => {
            resolve({ ok: true, item })
          }
        }),
    })
    await fillValid(wrapper)

    void submit(wrapper)
    void submit(wrapper)
    await wrapper.get('button[type="submit"]').trigger('click')
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true')
    finish()
    await flushPromises()

    expect(save).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('MenuItemForm: unsaved changes', () => {
  const dirtyEvents = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
    wrapper.emitted('dirty-change')?.map(([dirty]) => dirty)

  it('says it is clean when opened, and dirty once something differs', async () => {
    const { wrapper } = mountForm({ item })
    expect(dirtyEvents(wrapper)).toEqual([false])

    await field(wrapper, 'name').setValue('Renamed')

    expect(dirtyEvents(wrapper)).toEqual([false, true])
    wrapper.unmount()
  })

  it('is clean again when the change is undone', async () => {
    const { wrapper } = mountForm({ item })

    await field(wrapper, 'name').setValue('Renamed')
    await field(wrapper, 'name').setValue('Margherita pizza')

    expect(dirtyEvents(wrapper)).toEqual([false, true, false])
    wrapper.unmount()
  })

  it('counts an untouched new form as clean, and a typed one as dirty', async () => {
    const { wrapper } = mountForm()
    expect(dirtyEvents(wrapper)).toEqual([false])

    await field(wrapper, 'name').setValue('x')

    expect(dirtyEvents(wrapper)).toEqual([false, true])
    wrapper.unmount()
  })

  it('counts ticking an allergen as a change', async () => {
    const { wrapper } = mountForm({ item })

    await wrapper.findAll('input[type="checkbox"]')[0]?.setValue(true)

    expect(dirtyEvents(wrapper)).toEqual([false, true])
    wrapper.unmount()
  })

  it('asks its owner to close when Cancel is pressed', async () => {
    const { wrapper } = mountForm()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancel')
      ?.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})

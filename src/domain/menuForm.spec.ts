import { describe, expect, it } from 'vitest'
import {
  emptyMenuForm,
  formFromItem,
  inputFromItem,
  mapMenuServerErrors,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  sameForm,
  toMenuItemInput,
  validateMenuForm,
  type MenuForm,
} from '@/domain/menuForm'
import type { Category, MenuItem } from '@/types/domain'

const categories: Category[] = [
  { id: 'cat-starters', name: 'Starters', sortOrder: 1 },
  { id: 'cat-mains', name: 'Mains', sortOrder: 2 },
]

const item: MenuItem = {
  id: 'item-5',
  name: 'Margherita pizza',
  description: 'Tomato and basil.',
  priceCents: 1150,
  categoryId: 'cat-mains',
  imageUrl: null,
  available: true,
  allergens: ['dairy', 'gluten'],
}

const valid: MenuForm = {
  name: 'Apfelstrudel',
  description: 'Warm, with vanilla sauce.',
  price: '6.50',
  categoryId: 'cat-starters',
  imageUrl: '',
  available: true,
  allergens: ['gluten'],
}

describe('the starting forms', () => {
  it('starts a new dish empty, available, in the first category', () => {
    expect(emptyMenuForm(categories)).toEqual({
      name: '',
      description: '',
      price: '',
      categoryId: 'cat-starters',
      imageUrl: '',
      available: true,
      allergens: [],
    })
  })

  it('turns a dish into a form, with the price as the text of an input', () => {
    expect(formFromItem(item)).toEqual({
      name: 'Margherita pizza',
      description: 'Tomato and basil.',
      price: '11.50',
      categoryId: 'cat-mains',
      imageUrl: '',
      available: true,
      allergens: ['dairy', 'gluten'],
    })
  })

  it('does not share the allergens array with the dish', () => {
    const form = formFromItem(item)
    form.allergens.push('eggs')

    expect(item.allergens).toEqual(['dairy', 'gluten'])
  })
})

describe('sameForm', () => {
  it('is true for a copy, whatever order the allergens were ticked in', () => {
    const copy: MenuForm = { ...formFromItem(item), allergens: ['gluten', 'dairy'] }

    expect(sameForm(formFromItem(item), copy)).toBe(true)
  })

  const changes: [string, Partial<MenuForm>][] = [
    ['name', { name: 'x' }],
    ['description', { description: 'x' }],
    ['price', { price: '1.00' }],
    ['category', { categoryId: 'cat-starters' }],
    ['image', { imageUrl: 'https://example.test/a.jpg' }],
    ['availability', { available: false }],
    ['allergens', { allergens: ['dairy'] }],
  ]

  it.each(changes)('notices a change of the %s', (_label, change) => {
    expect(sameForm(formFromItem(item), { ...formFromItem(item), ...change })).toBe(false)
  })
})

describe('validateMenuForm', () => {
  it('accepts a complete form', () => {
    expect(validateMenuForm(valid, categories)).toEqual({})
  })

  it('reports every problem at once', () => {
    const errors = validateMenuForm(
      { ...valid, name: ' ', price: '', categoryId: 'cat-x', imageUrl: 'ftp://x' },
      categories,
    )

    expect(Object.keys(errors).sort()).toEqual(['categoryId', 'imageUrl', 'name', 'price'])
  })

  it('limits the name and description to what the API accepts', () => {
    expect(validateMenuForm({ ...valid, name: 'a'.repeat(MAX_NAME_LENGTH) }, categories)).toEqual(
      {},
    )
    expect(
      validateMenuForm({ ...valid, name: 'a'.repeat(MAX_NAME_LENGTH + 1) }, categories).name,
    ).toMatch(/80/)
    expect(
      validateMenuForm(
        { ...valid, description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1) },
        categories,
      ).description,
    ).toMatch(/500/)
  })

  it('allows an empty description, as the API does', () => {
    expect(validateMenuForm({ ...valid, description: '' }, categories)).toEqual({})
  })

  it.each([
    ['', 'Price is required'],
    ['abc', 'Enter a price like 11.50'],
    ['1.234', 'Enter a price like 11.50'],
    ['0', 'Price must be more than zero'],
    ['0.00', 'Price must be more than zero'],
  ])('says what is wrong with the price %j', (price, message) => {
    expect(validateMenuForm({ ...valid, price }, categories).price).toBe(message)
  })

  it.each(['11', '11.5', '11,50', '0.01'])('accepts the price %j', (price) => {
    expect(validateMenuForm({ ...valid, price }, categories).price).toBeUndefined()
  })

  it.each([
    'https://example.test/a.jpg',
    'http://example.test/a.jpg',
    'data:image/svg+xml;utf8,<svg/>',
    '',
  ])('accepts the image %j', (imageUrl) => {
    expect(validateMenuForm({ ...valid, imageUrl }, categories).imageUrl).toBeUndefined()
  })

  it.each(['example.test/a.jpg', 'javascript:alert(1)', 'ftp://x/a.jpg', 'data:text/html,x'])(
    'rejects the image %j',
    (imageUrl) => {
      expect(validateMenuForm({ ...valid, imageUrl }, categories).imageUrl).toBeDefined()
    },
  )

  it('needs a category that exists', () => {
    expect(validateMenuForm({ ...valid, categoryId: '' }, categories).categoryId).toBe(
      'Choose a category',
    )
  })
})

describe('toMenuItemInput', () => {
  it('builds the request: trimmed text, cents, null for no image, allergens in a fixed order', () => {
    expect(
      toMenuItemInput({
        ...valid,
        name: ' Apfelstrudel ',
        description: ' Warm. ',
        price: '6,5',
        imageUrl: '  ',
        allergens: ['gluten', 'dairy'],
      }),
    ).toEqual({
      name: 'Apfelstrudel',
      description: 'Warm.',
      priceCents: 650,
      categoryId: 'cat-starters',
      imageUrl: null,
      available: true,
      allergens: ['gluten', 'dairy'],
    })
  })

  it('keeps an image address', () => {
    expect(toMenuItemInput({ ...valid, imageUrl: ' https://example.test/a.jpg ' })?.imageUrl).toBe(
      'https://example.test/a.jpg',
    )
  })

  it('gives nothing for a price that is not one', () => {
    expect(toMenuItemInput({ ...valid, price: 'abc' })).toBeNull()
  })
})

describe('inputFromItem', () => {
  it('is the dish without its id, ready to be saved again', () => {
    expect(inputFromItem(item)).toEqual({
      name: 'Margherita pizza',
      description: 'Tomato and basil.',
      priceCents: 1150,
      categoryId: 'cat-mains',
      imageUrl: null,
      available: true,
      allergens: ['dairy', 'gluten'],
    })
  })
})

describe('mapMenuServerErrors', () => {
  it('puts the API field names on the form inputs (priceCents is the price input)', () => {
    const { fields, general } = mapMenuServerErrors({
      name: 'Name is required',
      priceCents: 'Price must be a positive whole number of cents',
      categoryId: 'Choose an existing category',
    })

    expect(fields).toEqual({
      name: 'Name is required',
      price: 'Price must be a positive whole number of cents',
      categoryId: 'Choose an existing category',
    })
    expect(general).toEqual([])
  })

  it('passes on what it does not know instead of dropping it', () => {
    expect(
      mapMenuServerErrors({ available: 'Availability must be true or false' }).general,
    ).toEqual(['Availability must be true or false'])
  })
})

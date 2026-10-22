import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simulateOffline } from '@/composables/useOnline'
import * as reload from '@/devtools/reload'
import { getMockConditions } from '@/mocks/conditions'
import { db } from '@/mocks/db'
import { menuItems } from '@/mocks/fixtures'
import { mountAppAt, unmountApps } from '@/test/mountApp'

// The panel sits beside the router view, outside the first root element the wrapper searches, so
// these tests look at the whole page.
async function mountApp() {
  await mountAppAt('/')
  await vi.waitFor(() => {
    expect(document.querySelector('button[aria-expanded]')).not.toBeNull() // loaded lazily
  })
  return new DOMWrapper(document.body)
}

const toggleButton = (wrapper: DOMWrapper<HTMLElement>) => wrapper.get('button[aria-expanded]')

afterEach(() => {
  unmountApps()
  simulateOffline(false)
})

describe('Dev tools panel', () => {
  it('is a collapsed button until opened', async () => {
    const wrapper = await mountApp()

    expect(toggleButton(wrapper).text()).toBe('Dev tools')
    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
    expect(wrapper.findAll('#devtools-title')).toHaveLength(0)

    await toggleButton(wrapper).trigger('click')

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('section[aria-labelledby="devtools-title"]').isVisible()).toBe(true)
  })

  it('leaves room at the bottom of the page for its button while it is there', async () => {
    await mountAppAt('/')
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains('has-devtools')).toBe(true)
    })

    unmountApps()

    expect(document.documentElement.classList.contains('has-devtools')).toBe(false)
  })

  it('shows the current conditions', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')

    const checked = wrapper.findAll<HTMLInputElement>('#devtools-title ~ fieldset input:checked')
    expect(checked.map((input) => input.element.value)).toEqual(['none', 'off'])
    expect(wrapper.get<HTMLInputElement>('section input[type="checkbox"]').element.checked).toBe(
      false,
    )
  })

  it('changes the latency, the error rate and offline for the next request', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')

    await wrapper.get('input[value="slow3g"]').setValue(true)
    await wrapper.get('input[value="sometimes"]').setValue(true)
    await wrapper.get('section input[type="checkbox"]').setValue(true)

    expect(getMockConditions()).toEqual({
      latency: 'slow3g',
      errorRate: 'sometimes',
      offline: true,
    })
  })

  it('offline shows the offline banner, and back online removes it', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')

    await wrapper.get('section input[type="checkbox"]').setValue(true)
    expect(wrapper.get('[role="status"]').text()).toContain('You are offline')

    await wrapper.get('section input[type="checkbox"]').setValue(false)
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it('"Reset network" goes back to the defaults', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')
    await wrapper.get('input[value="verySlow"]').setValue(true)
    await wrapper.get('input[value="always"]').setValue(true)
    await wrapper.get('section input[type="checkbox"]').setValue(true)

    const reset = wrapper.findAll('button').find((button) => button.text() === 'Reset network')
    await reset?.trigger('click')

    expect(getMockConditions()).toEqual({ latency: 'fast', errorRate: 'off', offline: false })
    expect(
      wrapper
        .findAll<HTMLInputElement>('#devtools-title ~ fieldset input:checked')
        .map((i) => i.element.value),
    ).toEqual(['fast', 'off'])
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  describe('"Reset demo data"', () => {
    beforeEach(() => {
      vi.spyOn(reload, 'reloadPage').mockImplementation(() => undefined)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('brings back the original menu and orders, then reloads the page', async () => {
      const dish = menuItems[0]
      if (dish === undefined) throw new Error('no fixtures')
      db.deleteMenuItem(dish.id)
      expect(db.getMenuItem(dish.id)).toBeUndefined()
      const wrapper = await mountApp()
      await toggleButton(wrapper).trigger('click')

      const reset = wrapper.findAll('button').find((button) => button.text() === 'Reset demo data')
      await reset?.trigger('click')

      expect(db.getMenuItem(dish.id)).toEqual(dish)
      expect(reload.reloadPage).toHaveBeenCalledOnce()
    })
  })

  it('Escape closes the panel and returns focus to the button', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')
    wrapper.get<HTMLInputElement>('input[value="fast"]').element.focus()

    await wrapper.get('input[value="fast"]').trigger('keydown', { key: 'Escape' })

    expect(toggleButton(wrapper).attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggleButton(wrapper).element)
  })

  it('makes real requests fail when errors are forced', async () => {
    const wrapper = await mountApp()
    await toggleButton(wrapper).trigger('click')
    await wrapper.get('input[value="always"]').setValue(true)

    const { menuApi } = await import('@/api/menuApi')

    await expect(menuApi.listCategories()).rejects.toMatchObject({ status: 500 })
  })
})

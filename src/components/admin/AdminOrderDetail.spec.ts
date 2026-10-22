import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminOrderDetail from '@/components/admin/AdminOrderDetail.vue'
import type { Order, OrderStatus } from '@/types/domain'

function order(status: OrderStatus, overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    lines: [
      {
        menuItemId: 'item-5',
        name: 'Margherita pizza',
        unitPriceCents: 1100,
        quantity: 2,
        note: 'Extra basil',
      },
    ],
    totalCents: 2200,
    status,
    fulfillment: 'pickup',
    customer: { name: 'Anna Keller', phone: '+49 30 1234567' },
    createdAt: '2026-10-22T14:05:00.000Z',
    ...overrides,
  }
}

function mountDetail(status: OrderStatus, saving = false, overrides: Partial<Order> = {}) {
  return mount(AdminOrderDetail, {
    props: { order: order(status, overrides), saving },
    attachTo: document.body,
  })
}

const buttons = (wrapper: ReturnType<typeof mountDetail>) =>
  wrapper.findAll('.actions button').map((button) => button.text())

describe('AdminOrderDetail: what it shows', () => {
  it('shows the customer, how the order is collected, the items and the total', () => {
    const wrapper = mountDetail('new')

    expect(wrapper.text()).toContain('Anna Keller')
    expect(wrapper.text()).toContain('Pickup at the restaurant')
    expect(wrapper.text()).toContain('Margherita pizza')
    expect(wrapper.text()).toContain('Extra basil')
    expect(wrapper.text()).toContain('€22.00')
    expect(wrapper.get('a[href^="tel:"]').attributes('href')).toBe('tel:+49301234567')
    wrapper.unmount()
  })

  it('shows the address of a delivery', () => {
    const wrapper = mountDetail('new', false, {
      fulfillment: 'delivery',
      customer: { name: 'Anna', phone: '+49 30 1234567', address: 'Hauptstr. 1, Berlin' },
    })

    expect(wrapper.text()).toContain('Delivery to')
    expect(wrapper.text()).toContain('Hauptstr. 1, Berlin')
    wrapper.unmount()
  })
})

describe('AdminOrderDetail: the buttons', () => {
  it.each([
    ['new', ['Start preparing', 'Cancel order']],
    ['preparing', ['Mark as ready', 'Cancel order']],
    ['ready', ['Mark as completed']],
  ] as const)('offers exactly the moves a %s order can make', (status, expected) => {
    const wrapper = mountDetail(status)

    expect(buttons(wrapper)).toEqual(expected)
    wrapper.unmount()
  })

  it.each(['completed', 'cancelled'] as const)(
    'renders no button at all for a %s order, and says why',
    (status) => {
      const wrapper = mountDetail(status)

      expect(wrapper.find('.actions button').exists()).toBe(false)
      expect(wrapper.get('.actions').text()).toContain(`This order is ${status}`)
      wrapper.unmount()
    },
  )

  it('emits the status the button moves to', async () => {
    const wrapper = mountDetail('new')

    await wrapper.findAll('.actions button')[0]?.trigger('click')
    await wrapper.findAll('.actions button')[1]?.trigger('click')

    expect(wrapper.emitted('change-status')).toEqual([['preparing'], ['cancelled']])
    wrapper.unmount()
  })

  it('swallows presses while a change is on its way, and says it is busy', async () => {
    const wrapper = mountDetail('preparing', true)

    await wrapper.findAll('.actions button')[0]?.trigger('click')

    expect(wrapper.emitted('change-status')).toBeUndefined()
    expect(
      wrapper.findAll('.actions button').every((b) => b.attributes('aria-busy') === 'true'),
    ).toBe(true)
    wrapper.unmount()
  })

  it('marks the dangerous move as dangerous', () => {
    const wrapper = mountDetail('new')

    const cancel = wrapper.findAll('.actions button')[1]
    expect(cancel?.classes()).toContain('button--danger')
    wrapper.unmount()
  })
})

describe('AdminOrderDetail: focus', () => {
  it('follows to the first new button after the one that was pressed is replaced', async () => {
    const wrapper = mountDetail('new')
    wrapper.findAll<HTMLElement>('.actions button')[0]?.element.focus()

    await wrapper.setProps({ order: order('preparing') })
    await flushPromises()

    expect(document.activeElement?.textContent.trim()).toBe('Mark as ready')
    wrapper.unmount()
  })

  it('falls back to the panel when nothing is left to press', async () => {
    const wrapper = mountDetail('ready')
    wrapper.findAll<HTMLElement>('.actions button')[0]?.element.focus()

    await wrapper.setProps({ order: order('completed') })
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('.detail').element)
    wrapper.unmount()
  })

  it('does not take focus when the status changed while it was somewhere else', async () => {
    const wrapper = mountDetail('new')
    const other = document.createElement('input')
    document.body.append(other)
    other.focus()

    await wrapper.setProps({ order: order('preparing') })
    await flushPromises()

    expect(document.activeElement).toBe(other)
    other.remove()
    wrapper.unmount()
  })
})

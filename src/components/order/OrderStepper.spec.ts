import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OrderStepper from '@/components/order/OrderStepper.vue'
import type { Fulfillment, OrderStatus } from '@/types/domain'

function steps(status: OrderStatus, fulfillment: Fulfillment = 'pickup') {
  return mount(OrderStepper, { props: { status, fulfillment } })
    .findAll('li')
    .map((item) => ({
      label: item.get('.step__label').text(),
      state: ['step--done', 'step--current', 'step--upcoming'].find((name) => item.classes(name)),
      current: item.attributes('aria-current'),
    }))
}

describe('OrderStepper', () => {
  it('marks earlier steps done, the status current and later steps upcoming', () => {
    expect(steps('preparing')).toEqual([
      { label: 'Received', state: 'step--done', current: undefined },
      { label: 'Preparing', state: 'step--current', current: 'step' },
      { label: 'Ready', state: 'step--upcoming', current: undefined },
      { label: 'Completed', state: 'step--upcoming', current: undefined },
    ])
  })

  it('starts with the first step current', () => {
    expect(steps('new').map((step) => step.current)).toEqual([
      'step',
      undefined,
      undefined,
      undefined,
    ])
  })

  it('marks the final step current once completed', () => {
    const result = steps('completed')

    expect(result.slice(0, 3).every((step) => step.state === 'step--done')).toBe(true)
    expect(result[3]?.current).toBe('step')
  })

  it('does not rely on colour alone: each step says where it stands', () => {
    const text = mount(OrderStepper, { props: { status: 'ready', fulfillment: 'pickup' } }).text()

    expect(text).toContain('Received (done)')
    expect(text).toContain('Ready (current step)')
    expect(text).toContain('Completed (not yet)')
  })

  it('shows a delivery as one step longer, with "On the way" between ready and completed', () => {
    expect(steps('out_for_delivery', 'delivery')).toEqual([
      { label: 'Received', state: 'step--done', current: undefined },
      { label: 'Preparing', state: 'step--done', current: undefined },
      { label: 'Ready', state: 'step--done', current: undefined },
      { label: 'On the way', state: 'step--current', current: 'step' },
      { label: 'Completed', state: 'step--upcoming', current: undefined },
    ])
  })

  it('tells the layout how many columns to use: four for a pickup, five for a delivery', () => {
    const columns = (fulfillment: Fulfillment) =>
      mount(OrderStepper, { props: { status: 'new', fulfillment } })
        .get('ol')
        .attributes('style')

    expect(columns('pickup')).toContain('--steps: 4')
    expect(columns('delivery')).toContain('--steps: 5')
  })

  it('does not show "On the way" for a pickup', () => {
    expect(steps('ready').map((step) => step.label)).not.toContain('On the way')
  })
})

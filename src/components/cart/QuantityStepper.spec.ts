import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantityStepper from '@/components/cart/QuantityStepper.vue'

function mountStepper(modelValue: number, props: { min?: number; max?: number } = {}) {
  return mount(QuantityStepper, { props: { modelValue, label: 'Margherita pizza', ...props } })
}

const decrease = (wrapper: ReturnType<typeof mountStepper>) =>
  wrapper.get('[aria-label="Decrease quantity"]')
const increase = (wrapper: ReturnType<typeof mountStepper>) =>
  wrapper.get('[aria-label="Increase quantity"]')

describe('QuantityStepper', () => {
  it('is a group named after the dish and shows the quantity', () => {
    const wrapper = mountStepper(3)

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe(
      'Quantity of Margherita pizza',
    )
    expect(wrapper.get('output').text()).toBe('3')
  })

  it('increases and decreases by one', async () => {
    const wrapper = mountStepper(3)

    await increase(wrapper).trigger('click')
    await decrease(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[4], [3]])
  })

  it('does not go below the minimum, and the button says so without losing focus', async () => {
    const wrapper = mountStepper(1)

    await decrease(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(decrease(wrapper).attributes('aria-disabled')).toBe('true')
    // Really disabled buttons drop keyboard focus; this one must stay focusable.
    expect(decrease(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('does not go above the maximum', async () => {
    const wrapper = mountStepper(99)

    await increase(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(increase(wrapper).attributes('aria-disabled')).toBe('true')
  })

  it('respects custom limits', async () => {
    const wrapper = mountStepper(5, { min: 5, max: 6 })

    await decrease(wrapper).trigger('click')
    await increase(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[6]])
  })

  it('announces the new quantity politely', () => {
    expect(mountStepper(2).get('output').attributes('aria-live')).toBe('polite')
  })
})

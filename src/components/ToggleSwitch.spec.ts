import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

function mountSwitch(modelValue: boolean, busy = false) {
  return mount(ToggleSwitch, { props: { checked: modelValue, label: 'Lasagna available', busy } })
}

describe('ToggleSwitch', () => {
  it('is a switch with a name and a state', () => {
    const wrapper = mountSwitch(true)

    expect(wrapper.get('button').attributes('role')).toBe('switch')
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Lasagna available')
    expect(mountSwitch(false).get('button').attributes('aria-checked')).toBe('false')
  })

  it('asks for the opposite value, and leaves the change to its owner', async () => {
    const on = mountSwitch(true)
    const off = mountSwitch(false)

    await on.get('button').trigger('click')
    await off.get('button').trigger('click')

    expect(on.emitted('toggle')).toEqual([[false]])
    expect(off.emitted('toggle')).toEqual([[true]])
  })

  it('says it is busy without becoming disabled, so it keeps keyboard focus', () => {
    const wrapper = mountSwitch(true, true)

    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })
})

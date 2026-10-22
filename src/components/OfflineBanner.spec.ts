import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineBanner from '@/components/OfflineBanner.vue'
import { simulateOffline } from '@/composables/useOnline'

afterEach(() => {
  simulateOffline(false)
  window.dispatchEvent(new Event('online'))
})

describe('OfflineBanner', () => {
  it('is empty while there is a connection, inside a status region that is always present', () => {
    const wrapper = mount(OfflineBanner)

    expect(wrapper.get('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })

  it('appears when the browser goes offline and disappears when it comes back', async () => {
    const wrapper = mount(OfflineBanner)

    window.dispatchEvent(new Event('offline'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('You are offline')

    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })

  it('also shows for offline simulated by the Dev tools', async () => {
    const wrapper = mount(OfflineBanner)

    simulateOffline(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('You are offline')

    simulateOffline(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('stays offline until both the browser and the simulation say there is a connection', async () => {
    const wrapper = mount(OfflineBanner)

    window.dispatchEvent(new Event('offline'))
    simulateOffline(true)
    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('You are offline')
    wrapper.unmount()
  })

  it('stops listening once unmounted', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(OfflineBanner)

    wrapper.unmount()

    expect(removed).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removed).toHaveBeenCalledWith('offline', expect.any(Function))
    removed.mockRestore()
  })
})

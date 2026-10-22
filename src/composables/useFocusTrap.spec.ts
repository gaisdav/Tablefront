import { flushPromises } from '@vue/test-utils'
import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from '@/composables/useFocusTrap'

const cleanups: (() => void)[] = []

function setup() {
  const opener = document.createElement('button')
  const container = document.createElement('div')
  const field = document.createElement('input')
  container.append(field)
  document.body.append(opener, container)
  opener.focus()

  const active = ref(true)
  const scope = effectScope()
  scope.run(() => {
    useFocusTrap(active, ref(container))
  })
  cleanups.push(() => {
    scope.stop()
    opener.remove()
    container.remove()
  })
  return { active, opener, container, field }
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe('useFocusTrap', () => {
  it('moves focus in once rendered', async () => {
    const { field } = setup()

    await flushPromises()

    expect(document.activeElement).toBe(field)
  })

  it('does not move focus into a container that was deactivated before it finished activating', async () => {
    const { active, container } = setup()
    const focusedInside: HTMLElement[] = []
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (container.contains(this)) focusedInside.push(this)
    })

    active.value = false // within the same tick in which it activated
    await flushPromises()
    spy.mockRestore()

    expect(focusedInside).toEqual([])
  })

  it('returns focus to the opener on deactivation and again after reactivation', async () => {
    const { active, opener, field } = setup()
    await flushPromises()
    expect(document.activeElement).toBe(field)

    active.value = false
    await flushPromises()
    expect(document.activeElement).toBe(opener)

    active.value = true
    await flushPromises()
    expect(document.activeElement).toBe(field)

    active.value = false
    await flushPromises()
    expect(document.activeElement).toBe(opener)
  })
})

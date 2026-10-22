import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BaseDialog from '@/components/BaseDialog.vue'

const mounted: VueWrapper[] = []
let opener: HTMLButtonElement | null = null

/** Opens a dialog the way a page would: from a button that has focus. */
function openDialog(props: { open?: boolean } = {}, slots: Record<string, () => unknown> = {}) {
  opener = document.createElement('button')
  opener.textContent = 'Open'
  document.body.append(opener)
  opener.focus()

  const wrapper = mount(BaseDialog, {
    props: { open: true, title: 'Edit item', ...props },
    slots: {
      default: () => [h('input', { id: 'name' }), h('button', { id: 'save' }, 'Save')],
      footer: () => h('button', { id: 'cancel' }, 'Cancel'),
      ...slots,
    },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]')
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} not found`)
  return element
}

function press(
  key: string,
  options: KeyboardEventInit = {},
  target: Element = document.activeElement ?? document.body,
) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  opener?.remove()
  opener = null
  document.body.classList.remove('scroll-locked')
})

describe('BaseDialog', () => {
  it('renders nothing while closed', () => {
    openDialog({ open: false })

    expect(dialog()).toBeNull()
  })

  it('is a modal dialog labelled by its title', () => {
    openDialog()

    const element = dialog()
    expect(element?.getAttribute('aria-modal')).toBe('true')
    const labelId = element?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(labelId)?.textContent).toBe('Edit item')
    expect(byId('cancel').closest('footer')).not.toBeNull()
  })

  it('moves focus to the first control in the content, not to the close button', async () => {
    openDialog()
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(byId('name'))
    })
  })

  it('falls back to the close button when the content has nothing focusable', async () => {
    openDialog({}, { default: () => h('p', 'Saved.'), footer: () => [] })
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[aria-label="Close dialog"]'))
    })
  })
})

describe('BaseDialog placement', () => {
  it('is a centred dialog by default', () => {
    openDialog()

    expect(dialog()?.classList.contains('panel--side')).toBe(false)
  })

  it('can be a side panel, for a cart or a filter drawer', () => {
    opener = document.createElement('button')
    document.body.append(opener)
    const wrapper = mount(BaseDialog, {
      props: { open: true, title: 'Your order', placement: 'side' },
      slots: { default: () => h('p', 'Content') },
      attachTo: document.body,
    })
    mounted.push(wrapper)

    expect(dialog()?.classList.contains('panel--side')).toBe(true)
    expect(dialog()?.parentElement?.classList.contains('backdrop--side')).toBe(true)
  })
})

describe('BaseDialog focus trap', () => {
  it('wraps Tab from the last control back to the first', () => {
    openDialog()
    byId('cancel').focus()

    const event = press('Tab')

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Close dialog"]'))
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    openDialog()
    const close = document.querySelector<HTMLElement>('[aria-label="Close dialog"]')
    close?.focus()

    const event = press('Tab', { shiftKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(byId('cancel'))
  })

  it('leaves Tab alone between the first and last control', () => {
    openDialog()
    byId('name').focus()

    const event = press('Tab')

    expect(event.defaultPrevented).toBe(false)
  })

  it('pulls focus back in if it ends up on the dialog container itself', () => {
    openDialog()
    dialog()?.focus()

    press('Tab')

    expect(document.activeElement).toBe(document.querySelector('[aria-label="Close dialog"]'))
  })

  it('pulls focus back in when Tab is pressed while focus is on the page body', () => {
    openDialog()
    byId('name').focus()
    byId('name').blur()

    const event = press('Tab')

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Close dialog"]'))
  })

  it('skips hidden and negatively tabbable elements when wrapping', () => {
    openDialog(
      {},
      {
        default: () => [
          h('button', { id: 'save' }, 'Save'),
          h('button', { id: 'hidden-button', hidden: true }, 'Hidden'),
          h('input', { type: 'hidden' }),
          h('button', { id: 'skipped', tabindex: -2 }, 'Skipped'),
        ],
        footer: () => [],
      },
    )
    byId('save').focus()

    press('Tab')
    expect(document.activeElement).toBe(document.querySelector('[aria-label="Close dialog"]'))

    press('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(byId('save'))
  })

  it('keeps the original opener when the dialog is closed and reopened', async () => {
    const wrapper = openDialog()
    byId('save').focus()

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(byId('name'))
    })
    await wrapper.setProps({ open: false })

    expect(document.activeElement).toBe(opener)
  })

  it('keeps focus on the dialog when there is nothing to tab to', () => {
    openDialog({}, { default: () => h('p', 'Saved.'), footer: () => [] })
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')
    close?.setAttribute('disabled', '')
    dialog()?.focus()

    const event = press('Tab')

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dialog())
  })

  it('returns focus to the element that opened it, when closed from outside', async () => {
    const wrapper = openDialog()
    byId('save').focus()

    await wrapper.setProps({ open: false })

    expect(document.activeElement).toBe(opener)
  })

  it('returns focus to the opener when unmounted while open', () => {
    const wrapper = openDialog()
    byId('save').focus()

    wrapper.unmount()

    expect(document.activeElement).toBe(opener)
  })
})

describe('BaseDialog dismissing', () => {
  it('closes on Escape', () => {
    const wrapper = openDialog()
    byId('name').focus()

    press('Escape')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes on Escape even when focus has fallen to the page', () => {
    const wrapper = openDialog()
    byId('name').focus()
    byId('name').blur()
    expect(document.activeElement).toBe(document.body)

    press('Escape')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes only the topmost of two stacked dialogs on Escape', () => {
    const below = openDialog()
    const above = openDialog()

    press('Escape')

    expect(above.emitted('update:open')).toEqual([[false]])
    expect(below.emitted('update:open')).toBeUndefined()
  })

  it('ignores Escape while the user is composing text with an IME', () => {
    const wrapper = openDialog()

    press('Escape', { isComposing: true })

    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('closes from the close button', () => {
    const wrapper = openDialog()

    document.querySelector<HTMLElement>('[aria-label="Close dialog"]')?.click()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  describe('backdrop', () => {
    function mouse(target: Element | null | undefined, type: 'mousedown' | 'mouseup') {
      target?.dispatchEvent(new MouseEvent(type, { bubbles: true }))
    }

    it('closes when a press starts and ends on the backdrop', () => {
      const wrapper = openDialog()
      const backdrop = dialog()?.parentElement

      mouse(backdrop, 'mousedown')
      mouse(backdrop, 'mouseup')

      expect(wrapper.emitted('update:open')).toEqual([[false]])
    })

    it('stays open when the press is inside the panel', () => {
      const wrapper = openDialog()

      mouse(dialog(), 'mousedown')
      mouse(dialog(), 'mouseup')

      expect(wrapper.emitted('update:open')).toBeUndefined()
    })

    it('stays open when a press starts in the panel and ends on the backdrop (a text selection drag)', () => {
      const wrapper = openDialog()

      mouse(dialog(), 'mousedown')
      mouse(dialog()?.parentElement, 'mouseup')

      expect(wrapper.emitted('update:open')).toBeUndefined()
    })

    it('stays open when a press starts on the backdrop and ends in the panel', () => {
      const wrapper = openDialog()

      mouse(dialog()?.parentElement, 'mousedown')
      mouse(dialog(), 'mouseup')

      expect(wrapper.emitted('update:open')).toBeUndefined()
    })

    it('forgets an unfinished press, so a later stray mouseup does not close it', () => {
      const wrapper = openDialog()
      const backdrop = dialog()?.parentElement

      mouse(backdrop, 'mousedown')
      mouse(dialog(), 'mouseup')
      mouse(backdrop, 'mouseup')

      expect(wrapper.emitted('update:open')).toBeUndefined()
    })
  })
})

describe('BaseDialog scroll lock', () => {
  const locked = () => document.body.classList.contains('scroll-locked')

  it('locks page scrolling while open and releases it when closed', async () => {
    const wrapper = openDialog()
    expect(locked()).toBe(true)

    await wrapper.setProps({ open: false })

    expect(locked()).toBe(false)
  })

  it('keeps the page locked until every open dialog has closed', async () => {
    const first = openDialog()
    const second = openDialog()

    await first.setProps({ open: false })
    expect(locked()).toBe(true)

    await second.setProps({ open: false })
    expect(locked()).toBe(false)
  })

  it('does not touch an overflow style that other code set', async () => {
    document.body.style.overflow = 'scroll'
    const wrapper = openDialog()
    document.body.style.overflow = 'clip'

    await wrapper.setProps({ open: false })

    expect(document.body.style.overflow).toBe('clip')
    document.body.style.overflow = ''
  })
})

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
  document.body.style.overflow = ''
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

  it('does not let Escape reach handlers outside the dialog', () => {
    const outside = vi.fn()
    document.body.addEventListener('keydown', outside)
    openDialog()
    byId('name').focus()

    press('Escape')

    expect(outside).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', outside)
  })

  it('closes from the close button', () => {
    const wrapper = openDialog()

    document.querySelector<HTMLElement>('[aria-label="Close dialog"]')?.click()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('closes when the backdrop is pressed, but not when the panel is', () => {
    const wrapper = openDialog()

    dialog()?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('update:open')).toBeUndefined()

    dialog()?.parentElement?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

describe('BaseDialog scroll lock', () => {
  it('locks page scrolling while open and restores it when closed', async () => {
    document.body.style.overflow = 'auto'
    const wrapper = openDialog()

    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ open: false })

    expect(document.body.style.overflow).toBe('auto')
  })

  it('keeps the page locked until every open dialog has closed', async () => {
    const first = openDialog()
    const second = openDialog()

    await first.setProps({ open: false })
    expect(document.body.style.overflow).toBe('hidden')

    await second.setProps({ open: false })
    expect(document.body.style.overflow).toBe('')
  })
})

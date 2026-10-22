import { expect, openMenu, test } from './support'
import type { Page } from '@playwright/test'

/** What a screen reader would call the focused element. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (element === null) return ''
    const label = element.getAttribute('aria-label')
    if (label !== null) return label
    if (element instanceof HTMLInputElement) {
      const labels: NodeListOf<HTMLLabelElement> | null = element.labels
      return labels === null ? '' : labels.item(0).textContent.trim()
    }
    return element.textContent.trim()
  })
}

/** Presses Tab (or Shift+Tab) until the focus lands on `name`; fails if it never does. */
async function tabTo(page: Page, name: string | RegExp, direction: 'forward' | 'back' = 'forward') {
  for (let presses = 0; presses < 80; presses += 1) {
    await page.keyboard.press(direction === 'forward' ? 'Tab' : 'Shift+Tab')
    const current = await focusedName(page)
    if (typeof name === 'string' ? current === name : name.test(current)) return
  }
  throw new Error(`Focus never reached ${String(name)} by keyboard`)
}

test.describe('keyboard only', () => {
  test('a whole order can be placed without a mouse, and focus is always visible', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)

    // Pick a dish.
    await tabTo(page, 'Add Bruschetta to cart')
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement ?? document.body).outlineStyle,
    )
    expect(outline).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('group', { name: 'Quantity of Bruschetta' })).toBeVisible()
    await expect(
      page
        .getByRole('group', { name: 'Quantity of Bruschetta' })
        .getByRole('button', { name: 'Increase quantity' }),
    ).toBeFocused()

    // Open the cart and go on to checkout.
    await tabTo(page, 'Cart, 1 item', 'back')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Your order' })).toBeVisible()
    await tabTo(page, 'Go to checkout')
    await page.keyboard.press('Enter')

    // The new page announces itself: focus is on its heading.
    await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeFocused()

    // Fill the form.
    await tabTo(page, 'Name')
    await page.keyboard.type('Anna Becker')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Phone')).toBeFocused()
    await page.keyboard.type('+49 30 1234567')
    await tabTo(page, /^Place order/)
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('the first Tab stop is the skip link, and it moves focus to the content', async ({
    page,
  }) => {
    // A fresh page, with nothing focused yet.
    await page.goto('/')
    await expect(page.getByRole('article').first()).toBeVisible()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('main#main')).toBeFocused()
  })

  test('a dialog keeps Tab inside it', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await page.getByRole('button', { name: 'Add Bruschetta to cart' }).click()
    await page.getByRole('button', { name: 'Cart, 1 item' }).click()
    const drawer = page.getByRole('dialog', { name: 'Your order' })
    await expect(drawer).toBeVisible()

    for (let presses = 0; presses < 12; presses += 1) {
      await page.keyboard.press('Tab')
      const inside = await drawer.evaluate((element) => element.contains(document.activeElement))
      expect(inside).toBe(true)
    }
  })
})

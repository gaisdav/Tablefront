import { addDish, expect, openMenu, test } from './support'

const DISH = 'Bruschetta'

test.describe('the cart', () => {
  test('the card turns into a stepper, and back into "Add" at zero', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    const group = page.getByRole('group', { name: `Quantity of ${DISH}` })

    await addDish(page, DISH)
    await expect(group).toBeVisible()
    await expect(group).toContainText('1')
    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()

    await group.getByRole('button', { name: 'Increase quantity' }).click()
    await expect(group).toContainText('2')
    await expect(page.getByRole('button', { name: 'Cart, 2 items' })).toBeVisible()

    await group.getByRole('button', { name: 'Decrease quantity' }).click()
    await group.getByRole('button', { name: `Remove ${DISH} from cart` }).click()

    await expect(group).toBeHidden()
    await expect(page.getByRole('button', { name: `Add ${DISH} to cart` })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cart, empty' })).toBeVisible()
  })

  test('the drawer lists the dishes, changes quantities and removes them', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await addDish(page, DISH)
    await addDish(page, 'Weissbier')

    await page.getByRole('button', { name: /^Cart, 2 items/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Your order' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: DISH })).toBeVisible()

    await drawer
      .getByRole('group', { name: `Quantity of ${DISH}` })
      .getByRole('button', { name: 'Increase quantity' })
      .click()
    await expect(drawer.getByRole('group', { name: `Quantity of ${DISH}` })).toContainText('2')

    await drawer.getByRole('button', { name: 'Remove Weissbier from cart' }).click()
    await expect(drawer.getByRole('heading', { name: 'Weissbier' })).toBeHidden()

    await drawer.getByRole('button', { name: `Remove ${DISH} from cart` }).click()
    await expect(drawer.getByText('Your cart is empty')).toBeVisible()
  })

  test('closing the drawer with Escape returns focus to the cart button', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await addDish(page, DISH)
    const cart = page.getByRole('button', { name: /^Cart, 1 item/ })

    await cart.click()
    await expect(page.getByRole('dialog', { name: 'Your order' })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(cart).toBeFocused()
  })

  test('the cart is still there after a reload', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await addDish(page, DISH)
    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()
    await expect(page.getByRole('group', { name: `Quantity of ${DISH}` })).toBeVisible()
  })
})

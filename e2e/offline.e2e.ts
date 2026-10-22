import { expect, goToCheckout, openMenu, placePickupOrder, test } from './support'

test.describe('a lost connection', () => {
  test('the browser going offline shows the banner, and coming back removes it', async ({
    page,
    devTools,
    context,
  }) => {
    await openMenu(page, devTools)

    await context.setOffline(true)
    await expect(page.getByText(/You are offline/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/You are offline/)).toBeHidden()
  })

  test('the Dev tools offline switch shows the banner and fails requests', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await devTools.configure({ offline: true })
    await expect(page.getByText(/You are offline/)).toBeVisible()

    await page.getByRole('radio', { name: 'Mains' }).check()

    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('an order that fails to send keeps the form, and goes through once back online', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await devTools.configure({ offline: true })

    await placePickupOrder(page)

    await expect(page.getByText('We could not place your order.')).toBeVisible()
    await expect(page.getByLabel('Phone')).toHaveValue('+49 30 1234567')

    await devTools.configure({ offline: false })
    await page.getByRole('button', { name: /^Place order/ }).click()

    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
  })
})

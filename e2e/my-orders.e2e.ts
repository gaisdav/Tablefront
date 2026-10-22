import { expect, goToCheckout, openApp, openMenu, placePickupOrder, test } from './support'

test.describe('my orders', () => {
  test('a browser with no orders has no link, and the page says so', async ({ page, devTools }) => {
    await openApp(page, devTools, '/orders')

    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Orders' }),
    ).toBeHidden()
    await expect(page.getByText('No orders yet')).toBeVisible()
  })

  test('a placed order is listed with its status and links to its tracking page', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await placePickupOrder(page)
    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    const id = /ord-\d+/.exec(page.url())?.[0]
    if (id === undefined) throw new Error('no order id in the address')

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Orders' })
      .click()

    await expect(page.getByRole('heading', { name: 'My orders', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
    const card = page.getByRole('article').filter({ hasText: id })
    await expect(card).toContainText('Received')
    await card.getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/orders/${id}$`))
  })

  test('the list is still there after a reload', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await placePickupOrder(page)
    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    const id = /ord-\d+/.exec(page.url())?.[0]
    if (id === undefined) throw new Error('no order id in the address')

    await page.goto('/orders')

    await expect(page.getByRole('article').filter({ hasText: id })).toBeVisible()
  })
})

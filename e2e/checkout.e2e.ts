import { DevTools, expect, goToCheckout, openMenu, placePickupOrder, signIn, test } from './support'

test.describe('checkout', () => {
  test('empty fields are explained and focus goes to the first one', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)

    await page.getByRole('button', { name: /^Place order/ }).click()

    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Phone is required')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeFocused()
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('a delivery needs an address, a pickup does not', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await expect(page.getByLabel('Delivery address')).toBeHidden()

    await page.getByRole('radio', { name: /Delivery/ }).check()
    await page.getByLabel('Name').fill('Anna Becker')
    await page.getByLabel('Phone').fill('+49 30 1234567')
    await page.getByRole('button', { name: /^Place order/ }).click()

    await expect(page.getByLabel('Delivery address')).toBeFocused()
    await expect(page.getByText(/address is required/i)).toBeVisible()
  })

  test('a server failure keeps what was typed and the cart, and a retry succeeds', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await devTools.configure({ errors: 'Always' })

    await placePickupOrder(page)

    await expect(page.getByText('We could not place your order.')).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveValue('Anna Becker')
    await expect(page).toHaveURL(/\/checkout$/)

    await devTools.configure({ errors: 'Never' })
    await page.getByRole('button', { name: /^Place order/ }).click()

    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
  })

  test('a placed order empties the cart and opens its tracking page', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)

    await placePickupOrder(page)

    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Received')
    await expect(page.getByRole('button', { name: 'Cart, empty' })).toBeVisible()
  })

  test('the order page follows the status the kitchen sets', async ({
    page,
    devTools,
    context,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await placePickupOrder(page)
    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    const id = /ord-\d+/.exec(page.url())?.[0]
    if (id === undefined) throw new Error('no order id in the address')

    // Staff in another tab of the same browser (the demo database is shared between tabs).
    const staff = await context.newPage()
    await staff.goto('/')
    await new DevTools(staff).configure({ latency: 'None' })
    await signIn(staff)
    await staff.getByRole('button', { name: new RegExp(id) }).click()
    await staff.getByRole('button', { name: 'Start preparing' }).click()
    await expect(staff.getByText(`Order ${id} is now preparing.`)).toBeVisible()

    // The page refreshes itself; it is announced as well as shown.
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('Preparing', { timeout: 20_000 })
    await expect(page.getByText('Order status: Preparing.')).toBeAttached()
    await staff.close()
  })
})

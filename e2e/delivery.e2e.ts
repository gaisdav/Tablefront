import { DevTools, expect, goToCheckout, openMenu, signIn, test } from './support'

test.describe('a delivery', () => {
  test('goes out for delivery, and the guest follows it to the door', async ({
    page,
    devTools,
    context,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await page.getByRole('radio', { name: /Delivery/ }).check()
    await page.getByLabel('Name').fill('Anna Becker')
    await page.getByLabel('Phone').fill('+49 30 1234567')
    await page.getByLabel('Delivery address').fill('Hauptstr. 1, 10115 Berlin')
    await page.getByRole('button', { name: /^Place order/ }).click()
    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    const id = /ord-\d+/.exec(page.url())?.[0]
    if (id === undefined) throw new Error('no order id in the address')
    // A delivery has a step a pickup does not.
    await expect(page.getByRole('listitem').filter({ hasText: 'On the way' })).toBeVisible()

    const staff = await context.newPage()
    await staff.goto('/')
    await new DevTools(staff).configure({ latency: 'None' })
    await signIn(staff)
    await staff.getByRole('button', { name: new RegExp(id) }).click()
    const press = async (button: string, saved: string) => {
      await staff.getByRole('button', { name: button }).click()
      await expect(staff.getByText(saved)).toBeVisible()
    }
    await press('Start preparing', `Order ${id} is now preparing.`)
    await press('Mark as ready', `Order ${id} is now ready.`)
    // The one move only a delivery has, and the only way on from "ready".
    await expect(staff.getByRole('button', { name: 'Mark as completed' })).toBeHidden()
    await press('Out for delivery', `Order ${id} is now on the way.`)

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('On the way', { timeout: 20_000 })
    await expect(page.getByText('Order status: On the way.')).toBeAttached()
    await expect(page.getByRole('listitem').filter({ hasText: 'On the way' })).toHaveAttribute(
      'aria-current',
      'step',
    )

    await press('Mark as completed', `Order ${id} is now completed.`)
    await expect(heading).toHaveText('Completed', { timeout: 20_000 })
    await staff.close()
  })

  test('a pickup is never offered the courier', async ({ page, devTools, context }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    await page.getByLabel('Name').fill('Anna Becker')
    await page.getByLabel('Phone').fill('+49 30 1234567')
    await page.getByRole('button', { name: /^Place order/ }).click()
    await expect(page).toHaveURL(/\/orders\/ord-\d+$/)
    const id = /ord-\d+/.exec(page.url())?.[0]
    if (id === undefined) throw new Error('no order id in the address')
    await expect(page.getByRole('listitem').filter({ hasText: 'On the way' })).toHaveCount(0)

    const staff = await context.newPage()
    await staff.goto('/')
    await new DevTools(staff).configure({ latency: 'None' })
    await signIn(staff)
    await staff.getByRole('button', { name: new RegExp(id) }).click()
    for (const [button, saved] of [
      ['Start preparing', 'preparing'],
      ['Mark as ready', 'ready'],
    ] as const) {
      await staff.getByRole('button', { name: button }).click()
      await expect(staff.getByText(`Order ${id} is now ${saved}.`)).toBeVisible()
    }

    await expect(staff.getByRole('button', { name: 'Out for delivery' })).toBeHidden()
    await expect(staff.getByRole('button', { name: 'Mark as completed' })).toBeVisible()
    await staff.close()
  })
})

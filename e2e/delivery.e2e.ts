import {
  expect,
  goToCheckout,
  openMenu,
  placeOrder,
  pressStatus,
  staffOpens,
  test,
} from './support'

test.describe('a delivery', () => {
  test('goes out for delivery, and the guest follows it to the door', async ({
    page,
    devTools,
    context,
  }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    const id = await placeOrder(page, { delivery: true })
    // A delivery has a step a pickup does not.
    const stepper = page.locator('ol.stepper')
    await expect(stepper.getByRole('listitem')).toHaveCount(5)
    await expect(stepper.getByRole('listitem').filter({ hasText: 'On the way' })).toBeVisible()

    const staff = await staffOpens(context, id)
    await pressStatus(staff, id, 'Start preparing', 'preparing')
    await pressStatus(staff, id, 'Mark as ready', 'ready')
    // The only way on from "ready" for a delivery is the courier.
    await expect(staff.getByRole('button', { name: 'Mark as completed' })).toBeHidden()
    await pressStatus(staff, id, 'Out for delivery', 'on the way')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('On the way', { timeout: 20_000 })
    await expect(page.getByText('Order status: On the way.')).toBeAttached()
    await expect(stepper.locator('[aria-current="step"]')).toContainText('On the way')

    await pressStatus(staff, id, 'Mark as completed', 'completed')
    await expect(heading).toHaveText('Completed', { timeout: 20_000 })
    await staff.close()
  })

  test('a pickup is never offered the courier', async ({ page, devTools, context }) => {
    await openMenu(page, devTools)
    await goToCheckout(page)
    const id = await placeOrder(page)
    const stepper = page.locator('ol.stepper')
    await expect(stepper.getByRole('listitem')).toHaveCount(4)
    await expect(stepper.getByText('On the way')).toHaveCount(0)

    const staff = await staffOpens(context, id)
    await pressStatus(staff, id, 'Start preparing', 'preparing')
    await pressStatus(staff, id, 'Mark as ready', 'ready')

    await expect(staff.getByRole('button', { name: 'Out for delivery' })).toBeHidden()
    await expect(staff.getByRole('button', { name: 'Mark as completed' })).toBeVisible()
    await staff.close()
  })
})

import { expect, openApp, openMenu, test } from './support'

test.describe('browsing the menu', () => {
  test('shows the dishes and filters them by category and search, in the URL', async ({
    page,
    devTools,
  }) => {
    await openMenu(page, devTools)
    const dishes = page.getByRole('article')
    await expect(page.getByRole('heading', { name: 'Menu', level: 1 })).toBeVisible()
    await expect(page.getByText('18 dishes')).toBeVisible()

    await page.getByRole('radio', { name: 'Desserts' }).check()
    await expect(page).toHaveURL(/category=/)
    await expect(dishes).not.toHaveCount(18) // the new results have replaced the old ones
    const desserts = await dishes.count()
    expect(desserts).toBeGreaterThan(0)
    expect(desserts).toBeLessThan(18)

    await page.getByRole('searchbox', { name: 'Search the menu' }).fill('zzzz')
    await expect(page.getByText('No dishes')).toBeVisible()
    await expect(page).toHaveURL(/q=zzzz/)

    await page.getByRole('searchbox', { name: 'Search the menu' }).fill('')
    await expect(dishes).toHaveCount(desserts)
  })

  test('a filtered view survives a reload and can be shared', async ({ page, devTools }) => {
    await openMenu(page, devTools)
    await page.getByRole('radio', { name: 'Drinks' }).check()
    await expect(page).toHaveURL(/category=/)
    const url = page.url()

    await page.goto(url)

    await expect(page.getByRole('radio', { name: 'Drinks' })).toBeChecked()
  })

  test('a failed load shows an error with Retry that recovers', async ({ page, devTools }) => {
    // Only once everything is on screen: a request still in flight would take the failure too.
    await openMenu(page, devTools)
    await devTools.configure({ errors: 'Always' })
    await page.getByRole('radio', { name: 'Mains' }).check()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()

    await devTools.configure({ errors: 'Never' })
    await alert.getByRole('button', { name: 'Try again' }).click()

    await expect(alert).toBeHidden()
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('shows skeletons while a slow network is loading, then the dishes', async ({
    page,
    devTools,
  }) => {
    // The checkout page needs no data, so the menu is not loaded yet when the network slows down.
    await openApp(page, devTools, '/checkout')
    await devTools.configure({ latency: 'Slow 3G' })

    await page.getByRole('button', { name: 'Browse the menu' }).click()

    await expect(page.locator('.card-skeleton').first()).toBeVisible()
    await expect(page.getByRole('article').first()).toBeVisible()
    await expect(page.locator('.card-skeleton')).toHaveCount(0)
  })
})

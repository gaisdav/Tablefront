import { ADMIN, expect, openApp, signIn, test } from './support'

test.describe('staff sign-in', () => {
  test('an address in the staff area sends a visitor to sign in, then back', async ({
    page,
    devTools,
  }) => {
    await openApp(page, devTools, '/admin/menu')

    await expect(page).toHaveURL(/\/admin\/login\?redirect=/)
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/admin\/menu$/)
    await expect(page.getByRole('heading', { name: 'Menu', level: 1 })).toBeVisible()
  })

  test('wrong credentials are refused with a message and nothing is lost', async ({
    page,
    devTools,
  }) => {
    await openApp(page, devTools, '/admin/login')

    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByLabel('Email')).toHaveValue(ADMIN.email)
  })

  test('signing out closes the staff area', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
    await page.goto('/admin/orders')

    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('the orders board', () => {
  test('moves an order along, and the change shows at once', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    const order = page.getByRole('button', { name: /ord-1007/ })
    await expect(order).toContainText('Received')

    await order.click()
    await page.getByRole('button', { name: 'Start preparing' }).click()

    await expect(page.getByText('Order ord-1007 is now preparing.')).toBeVisible()
    await expect(order).toContainText('Preparing')
    await expect(page.getByRole('button', { name: 'Mark as ready' })).toBeVisible()
  })

  test('a refused change is undone, and the reason is shown', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    const order = page.getByRole('button', { name: /ord-1007/ })
    await expect(order).toContainText('Received')
    await devTools.configure({ errors: 'Always' })
    await order.click()

    await page.getByRole('button', { name: 'Start preparing' }).click()

    await expect(page.getByText(/Order ord-1007 was not changed to preparing/)).toBeVisible()
    await expect(order).toContainText('Received')
    await expect(page.getByRole('button', { name: 'Start preparing' })).toBeVisible()
  })

  test('an order that cannot be reached shows an error instead of an empty board', async ({
    page,
    devTools,
  }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    await expect(page.getByRole('button', { name: /ord-1007/ })).toBeVisible()
    await devTools.configure({ offline: true })

    await page.getByRole('button', { name: 'Refresh' }).click()

    await expect(page.getByText(/You are offline/)).toBeVisible()
  })
})

test.describe('menu management', () => {
  test('creates, edits and deletes a dish', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    await page.getByRole('link', { name: 'Menu' }).click()
    await expect(page.getByRole('heading', { name: 'Menu', level: 1 })).toBeVisible()

    // Create
    await page.getByRole('button', { name: 'Add dish' }).first().click()
    const form = page.getByRole('dialog', { name: 'Add a dish' })
    await form.getByLabel('Name').fill('Zimtschnecke')
    await form.getByLabel('Description').fill('Cinnamon roll, still warm.')
    await form.getByLabel('Price (€)').fill('3,50')
    await form.getByLabel('Category').selectOption({ label: 'Desserts' })
    await form.getByRole('button', { name: 'Add dish' }).click()
    const row = page.getByRole('row', { name: /Zimtschnecke/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText('€3.50')

    // Edit
    await row.getByRole('button', { name: 'Edit Zimtschnecke' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit Zimtschnecke' })
    await edit.getByLabel('Price (€)').fill('4')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(row).toContainText('€4.00')

    // Delete, with the question
    await row.getByRole('button', { name: 'Delete Zimtschnecke' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete Zimtschnecke?' })
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(row).toBeHidden()
  })

  test('a dish switched off is gone from the guest menu', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    await page.getByRole('link', { name: 'Menu' }).click()
    const row = page.getByRole('row', { name: /Bruschetta/ })
    await row.getByRole('switch', { name: 'Bruschetta available' }).click()
    await expect(row.getByRole('switch')).not.toBeChecked()
    // Saved, not just shown: the switch is busy until the server has answered.
    await expect(row.getByRole('switch')).not.toHaveAttribute('aria-busy', 'true')

    // Staff are shown sold-out dishes too, so look at the menu as a guest.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.goto('/')

    await expect(page.getByRole('article').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Burrata & tomatoes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bruschetta' })).toBeHidden()
  })

  test('an unsaved form asks before it is discarded', async ({ page, devTools }) => {
    await openApp(page, devTools, '/admin/login')
    await signIn(page)
    await page.getByRole('link', { name: 'Menu' }).click()
    await page.getByRole('button', { name: 'Add dish' }).first().click()
    await page.getByLabel('Name').fill('Half a dish')

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await expect(page.getByLabel('Name')).toHaveValue('Half a dish')
  })
})

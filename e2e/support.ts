import { expect, test as base, type Locator, type Page } from '@playwright/test'

export const ADMIN = { email: 'admin@tablefront.test', password: 'admin123' }

type Latency = 'None' | 'Fast' | 'Slow 3G' | 'Very slow'
type Errors = 'Never' | 'Sometimes' | 'Always'

/** The Dev tools panel, the way a reviewer uses it: force latency, errors and offline. */
export class DevTools {
  private readonly toggle: Locator

  constructor(private readonly page: Page) {
    this.toggle = page.getByRole('button', { name: 'Dev tools' })
  }

  async configure(settings: { latency?: Latency; errors?: Errors; offline?: boolean }) {
    await this.toggle.click()
    const panel = this.page.getByRole('region', { name: 'Dev tools' })
    if (settings.latency) await panel.getByRole('radio', { name: settings.latency }).check()
    if (settings.errors) await panel.getByRole('radio', { name: settings.errors }).check()
    if (settings.offline !== undefined) {
      await panel.getByRole('checkbox', { name: /Offline/ }).setChecked(settings.offline)
    }
    await this.page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  }
}

/**
 * Every test gets its own empty browser (nothing saved: no cart, orders, session or demo data),
 * and starts with no simulated latency so the suite is fast; a test asks for a slow or failing
 * network explicitly. Nothing waits for a fixed time: every wait is for something to appear.
 */
export const test = base.extend<{ devTools: DevTools }>({
  devTools: async ({ page }, use) => {
    await use(new DevTools(page))
  },
  page: async ({ page }, use) => {
    // Anything the app logs as an error or warning, or any uncaught exception, fails the test.
    // The browser's own note about a failed request is expected when a test forces a failure.
    const problems: string[] = []
    page.on('console', (message) => {
      if (!['error', 'warning'].includes(message.type())) return
      if (message.text().startsWith('Failed to load resource')) return
      problems.push(`console ${message.type()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => {
      problems.push(`uncaught: ${error.message}`)
    })
    await use(page)
    expect(problems).toEqual([])
  },
})

export { expect }

/** Opens the app and removes the simulated latency. */
export async function openApp(page: Page, devTools: DevTools, path = '/') {
  await page.goto(path)
  await devTools.configure({ latency: 'None' })
}

export async function signIn(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByLabel('Password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible()
}

/** Puts a dish in the cart from its card and returns its name. */
export async function addDish(page: Page, name: string) {
  await page.getByRole('button', { name: `Add ${name} to cart` }).click()
}

/** Opens the menu and waits until the dishes and the categories are both on screen. */
export async function openMenu(page: Page, devTools: DevTools) {
  await openApp(page, devTools)
  await expect(page.getByRole('article').first()).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Mains' })).toBeVisible()
}

/** Fills the checkout form for a pickup order and sends it. */
export async function placePickupOrder(page: Page, name = 'Anna Becker', phone = '+49 30 1234567') {
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Phone').fill(phone)
  await page.getByRole('button', { name: /^Place order/ }).click()
}

/** From the menu, with one dish in the cart, to the checkout form. */
export async function goToCheckout(page: Page, dish = 'Bruschetta') {
  await addDish(page, dish)
  await page.getByRole('button', { name: /^Cart, 1 item/ }).click()
  await page.getByRole('button', { name: 'Go to checkout' }).click()
  await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeVisible()
}

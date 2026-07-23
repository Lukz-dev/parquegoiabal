import { test, expect } from '@playwright/test'

test('signup flow (mocked API)', async ({ page }) => {
  // Mock the signup API to avoid relying on a database during e2e runs
  await page.route('**/api/auth/signup', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Conta criada com sucesso!' }),
    })
  })

  await page.goto('/signup')
  await page.fill('#signup-company', 'E2E Test Company')
  await page.fill('#signup-name', 'E2E User')
  const email = `e2e+${Date.now()}@example.com`
  await page.fill('#signup-email', email)
  await page.fill('#signup-password', 'Password123!')
  await page.click('#signup-submit')

  await page.waitForSelector('text=Conta criada com sucesso!', { timeout: 10000 })
  await expect(page.locator('text=Conta criada com sucesso!')).toBeVisible()
})

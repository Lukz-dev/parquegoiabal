import { test, expect } from '@playwright/test'

async function bootstrapAndLogin(page: import('@playwright/test').Page) {
  const setupResponse = await page.request.post('http://localhost:3000/api/test/setup', {
    data: { name: `E2E ${Date.now()}` },
  })
  expect(setupResponse.ok()).toBeTruthy()

  const setup = (await setupResponse.json()) as { companyId: string; email: string; password: string }

  await page.goto('/login')
  await page.fill('#login-email', setup.email)
  await page.fill('#login-password', setup.password)
  await page.click('#login-submit')
  await expect(page).toHaveURL('/')

  return setup
}

async function postJson(page: import('@playwright/test').Page, path: string, data: unknown) {
  return page.evaluate(async ({ path, data }) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
  }, { path, data })
}

test('create and delete product via test endpoints', async ({ page }) => {
  const setup = await bootstrapAndLogin(page)
  const companyId = setup.companyId

  const create = await postJson(page, '/api/test/create-product', { companyId, name: 'DeleteMe', sku: `DEL-1-${Date.now()}`, price: 5, stockQty: 5 })
  expect(create.ok).toBeTruthy()
  const created = JSON.parse(create.text) as { product: { id: string } }
  const productId = created.product.id

  const del = await postJson(page, '/api/test/delete-product', { productId })
  expect(del.ok).toBeTruthy()
  const delBody = JSON.parse(del.text) as { ok: boolean }
  expect(delBody.ok).toBeTruthy()

  const del2 = await postJson(page, '/api/test/delete-product', { productId })
  expect(del2.status).toBe(404)
})

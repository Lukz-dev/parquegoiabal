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

async function getJson(page: import('@playwright/test').Page, path: string) {
  return page.evaluate(async ({ path }) => {
    const response = await fetch(path, { cache: 'no-store' })
    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
  }, { path })
}

test('process sale via test endpoint reduces stock and creates sale', async ({ page }) => {
  const setup = await bootstrapAndLogin(page)
  const companyId = setup.companyId

  const p1Response = await postJson(page, '/api/test/create-product', { companyId, name: 'P1', sku: `P1-${Date.now()}`, price: 10, stockQty: 10 })
  expect(p1Response.ok).toBeTruthy()
  const p1 = JSON.parse(p1Response.text) as { product: { id: string } }

  const p2Response = await postJson(page, '/api/test/create-product', { companyId, name: 'P2', sku: `P2-${Date.now()}`, price: 5, stockQty: 5 })
  expect(p2Response.ok).toBeTruthy()
  const p2 = JSON.parse(p2Response.text) as { product: { id: string } }

  const items = [{ productId: p1.product.id, quantity: 2 }, { productId: p2.product.id, quantity: 1 }]
  const res = await postJson(page, '/api/test/process-sale', { companyId, items, paymentMethod: 'CASH', discount: 0 })
  expect(res.ok).toBeTruthy()
  const body = JSON.parse(res.text) as { sale: { id: string } }
  expect(body.sale).toBeTruthy()

  const prod1Response = await getJson(page, `/api/test/get-product?productId=${p1.product.id}`)
  expect(prod1Response.ok).toBeTruthy()
  const prod1 = JSON.parse(prod1Response.text) as { product: { stockQty: number } }
  expect(prod1.product.stockQty).toBe(8)

  const prod2Response = await getJson(page, `/api/test/get-product?productId=${p2.product.id}`)
  expect(prod2Response.ok).toBeTruthy()
  const prod2 = JSON.parse(prod2Response.text) as { product: { stockQty: number } }
  expect(prod2.product.stockQty).toBe(4)
})

test('process sale with 20+ items (batch optimization test)', async ({ page }) => {
  const setup = await bootstrapAndLogin(page)
  const companyId = setup.companyId

  // Create 20 products
  const productIds: string[] = []
  for (let i = 1; i <= 20; i++) {
    const pResponse = await postJson(page, '/api/test/create-product', {
      companyId,
      name: `Product-${i}`,
      sku: `SKU-${i}-${Date.now()}`,
      price: 10 + i,
      stockQty: 100,
    })
    expect(pResponse.ok).toBeTruthy()
    const p = JSON.parse(pResponse.text) as { product: { id: string } }
    productIds.push(p.product.id)
  }

  // Process all 20 items in a single sale
  const items = productIds.map((id, idx) => ({ productId: id, quantity: idx + 1 }))
  const res = await postJson(page, '/api/test/process-sale', { companyId, items, paymentMethod: 'CREDIT_CARD', discount: 5.5 })
  expect(res.ok).toBeTruthy()
  const body = JSON.parse(res.text) as { sale: { id: string; code: string; total: number } }
  expect(body.sale).toBeTruthy()
  expect(body.sale.code).toBeDefined()
  expect(body.sale.total).toBeGreaterThan(0)

  // Verify stock was reduced for all products
  for (let i = 0; i < productIds.length; i++) {
    const prodResponse = await getJson(page, `/api/test/get-product?productId=${productIds[i]}`)
    expect(prodResponse.ok).toBeTruthy()
    const prod = JSON.parse(prodResponse.text) as { product: { stockQty: number } }
    const expectedQty = 100 - (i + 1)
    expect(prod.product.stockQty).toBe(expectedQty)
  }
})

test('process sale with 50 items (stress test)', async ({ page }) => {
  const setup = await bootstrapAndLogin(page)
  const companyId = setup.companyId

  // Create 50 products
  const productIds: string[] = []
  for (let i = 1; i <= 50; i++) {
    const pResponse = await postJson(page, '/api/test/create-product', {
      companyId,
      name: `Product-Stress-${i}`,
      sku: `STRESS-${i}-${Date.now()}`,
      price: 5 + Math.floor(i / 2),
      stockQty: 100,
    })
    expect(pResponse.ok).toBeTruthy()
    const p = JSON.parse(pResponse.text) as { product: { id: string } }
    productIds.push(p.product.id)
  }

  // Process all 50 items in a single sale
  const items = productIds.map((id) => ({ productId: id, quantity: 2 }))
  const res = await postJson(page, '/api/test/process-sale', { companyId, items, paymentMethod: 'PIX', discount: 10 })
  expect(res.ok).toBeTruthy()
  const body = JSON.parse(res.text) as { sale: { id: string; code: string; total: number } }
  expect(body.sale).toBeTruthy()
  expect(body.sale.code).toBeDefined()
  expect(body.sale.total).toBeGreaterThan(0)

  // Verify a sample of stock was reduced (not all 50 to save test time)
  for (let i = 0; i < 10; i++) {
    const prodResponse = await getJson(page, `/api/test/get-product?productId=${productIds[i]}`)
    expect(prodResponse.ok).toBeTruthy()
    const prod = JSON.parse(prodResponse.text) as { product: { stockQty: number } }
    expect(prod.product.stockQty).toBe(98)
  }
})

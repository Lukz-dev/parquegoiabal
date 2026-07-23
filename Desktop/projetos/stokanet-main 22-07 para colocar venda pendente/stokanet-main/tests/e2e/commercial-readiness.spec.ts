import { test, expect, type Page } from '@playwright/test'

async function createAdminSession(page: Page) {
  const setupResponse = await page.request.post('http://localhost:3000/api/test/setup', {
    data: { name: `E2E Admin ${Date.now()}` },
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

async function createRealUser(page: Page) {
  const timestamp = Date.now()
  const email = `commercial-${timestamp}@example.com`
  const password = `Commercial123!${String(timestamp).slice(-4)}`

  await page.goto('/signup')
  await page.fill('#signup-company', `Commercial ${timestamp}`)
  await page.fill('#signup-name', 'Commercial User')
  await page.fill('#signup-email', email)
  await page.fill('#signup-password', password)
  await page.click('#signup-submit')

  await expect(page).toHaveURL('/plans?source=signup')
  return { email, password }
}

async function postJson(page: Page, path: string, data: unknown) {
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

async function getJson(page: Page, path: string) {
  return page.evaluate(async ({ path }) => {
    const response = await fetch(path, { cache: 'no-store' })
    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
  }, { path })
}

async function createSale(page: Page, companyId: string) {
  const sku = `SKU-${Date.now()}`
  const productResponse = await postJson(page, '/api/test/create-product', {
    companyId,
    name: 'Produto Comercial',
    sku,
    price: 12.5,
    stockQty: 20,
    minStock: 2,
  })
  expect(productResponse.ok).toBeTruthy()
  const product = JSON.parse(productResponse.text) as { product: { id: string } }

  const saleResponse = await postJson(page, '/api/test/process-sale', {
    companyId,
    items: [{ productId: product.product.id, quantity: 2 }],
    paymentMethod: 'PIX',
    discount: 0,
    notes: 'E2E commercial readiness',
  })
  expect(saleResponse.ok).toBeTruthy()
  const sale = JSON.parse(saleResponse.text) as { sale: { id: string; code: string } }

  return { productId: product.product.id, saleId: sale.sale.id, saleCode: sale.sale.code }
}

test('admin login opens the operational dashboard', async ({ page }) => {
  await createAdminSession(page)

  await expect(page.getByRole('heading', { name: 'Visão geral da operação' })).toBeVisible()
  await expect(page.getByText('Assinatura', { exact: true })).toBeVisible()
  await expect(page.getByText('Produtos ativos', { exact: true })).toBeVisible()
})

test('real signup reaches the pending flow', async ({ page }) => {
  const user = await createRealUser(page)
  await expect(page).toHaveURL('/plans?source=signup')

  await page.goto('/login')
  await page.fill('#login-email', user.email)
  await page.fill('#login-password', user.password)
  await page.click('#login-submit')
  await expect(page).toHaveURL('/plans?source=signup')
})

test('admin can create and update a company subscription plan', async ({ page }) => {
  await createAdminSession(page)
  const user = await createRealUser(page)

  await createAdminSession(page)

  await page.goto('/admin')
  const userRow = page.getByTestId(`admin-user-row-${user.email}`)
  await expect(userRow).toBeVisible()

  await userRow.locator('select[name="planType"]').selectOption('MONTHLY')
  await userRow.locator('select[name="billingMode"]').selectOption('ONE_TIME')
  await userRow.getByRole('button', { name: 'Criar plano' }).click()

  await page.goto('/admin')
  await expect(page.getByTestId(`admin-user-row-${user.email}`)).toContainText('Plano atual: Mensal')
  await expect(page.getByTestId(`admin-user-row-${user.email}`)).toContainText('Cobrança: Cobrança única')

  const updatedRow = page.getByTestId(`admin-user-row-${user.email}`)
  await updatedRow.locator('select[name="planType"]').selectOption('ANNUAL')
  await updatedRow.locator('select[name="billingMode"]').selectOption('RECURRING')
  await updatedRow.getByRole('button', { name: 'Salvar plano' }).click()

  await page.goto('/admin')
  await expect(page.getByTestId(`admin-user-row-${user.email}`)).toContainText('Plano atual: Anual')
  await expect(page.getByTestId(`admin-user-row-${user.email}`)).toContainText('Valor: R$ 1.020,00')
})

test('NFS-e export renders the national-style document for a sale', async ({ page }) => {
  const admin = await createAdminSession(page)
  const sale = await createSale(page, admin.companyId)

  await page.goto(`/api/export/nfse/${sale.saleId}`)
  await expect(page.getByText('NFS-e padrão nacional')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nota Fiscal de Serviço eletrônica' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prestador de serviço' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tomador de serviço' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Discriminação do serviço' })).toBeVisible()
  await expect(page.getByText('Documento interno', { exact: true })).toBeVisible()
  await expect(page.getByText(sale.saleCode)).toBeVisible()
})

test('sale processing updates stock and keeps the API response stable', async ({ page }) => {
  const admin = await createAdminSession(page)
  const sale = await createSale(page, admin.companyId)

  const productResponse = await getJson(page, `/api/test/get-product?productId=${sale.productId}`)
  expect(productResponse.ok).toBeTruthy()
  const product = JSON.parse(productResponse.text) as { product: { stockQty: number } }
  expect(product.product.stockQty).toBe(18)
})

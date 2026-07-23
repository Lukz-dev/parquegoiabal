const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const code = `TEST-${Date.now().toString().slice(-6)}`
  const sale = await prisma.sale.create({
    data: {
      code,
      subtotal: 100,
      discount: 0,
      total: 100,
      paymentMethod: 'PIX',
      nfeStatus: 'AUTORIZADO',
      nfeDanfeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      companyId: 'company-demo-1',
      items: {
        create: [
          { productId: 'prod-1', productName: 'Caixa Organizadora 20L', sku: 'CAI-001', quantity: 1, unitPrice: 79.9, total: 79.9 },
          { productId: 'prod-2', productName: 'Copo Térmico Inox 500ml', sku: 'COP-002', quantity: 1, unitPrice: 20.1, total: 20.1 },
        ],
      },
    },
    include: { items: true },
  })

  console.log('Created test sale:', sale.id, sale.code)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

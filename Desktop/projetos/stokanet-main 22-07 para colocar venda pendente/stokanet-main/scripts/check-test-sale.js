const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sale = await prisma.sale.findFirst({
    where: { code: { startsWith: 'TEST-' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, nfeStatus: true, nfeDanfeUrl: true }
  })
  console.log(sale)
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())

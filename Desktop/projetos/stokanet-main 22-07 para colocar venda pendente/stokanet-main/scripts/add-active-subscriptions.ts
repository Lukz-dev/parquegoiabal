import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Finding companies without subscription...')
  const companies = await prisma.company.findMany({
    where: { subscription: { is: null } },
    select: { id: true, name: true },
  })

  console.log(`Found ${companies.length} companies without subscription`)

  let created = 0
  for (const c of companies) {
    try {
      await prisma.subscription.create({
        data: {
          companyId: c.id,
          planType: 'MONTHLY',
          billingMode: 'ONE_TIME',
          status: 'ACTIVE',
          amount: 0,
          autoRenew: false,
        },
      })
      console.log('Created subscription for', c.name || c.id)
      created++
    } catch (err) {
      console.error('Failed for', c.id, err)
    }
  }

  console.log(`Done — created ${created} subscriptions`) 
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node activate-subscription.js <email>')
    process.exit(2)
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true } })
  if (!user) {
    console.log('User not found')
    process.exit(0)
  }

  if (!user.companyId) {
    console.log('User has no company')
    process.exit(0)
  }

  const subscription = await prisma.subscription.updateMany({ where: { companyId: user.companyId }, data: { status: 'ACTIVE', cancelledAt: null, expiresAt: null, autoRenew: true } })
  console.log('Updated subscriptions:', subscription)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

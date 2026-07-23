const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node check-user.js <email>')
    process.exit(2)
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isApproved: true, isSystemAdmin: true, companyId: true } })
  if (!user) {
    console.log('User not found')
    process.exit(0)
  }

  console.log('User:', { id: user.id, email: user.email, isApproved: user.isApproved, isSystemAdmin: user.isSystemAdmin, companyId: user.companyId })

  if (user.companyId) {
    const subscription = await prisma.subscription.findUnique({ where: { companyId: user.companyId } })
    console.log('Subscription:', subscription || 'none')
  } else {
    console.log('No company associated')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

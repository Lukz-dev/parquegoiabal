import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  
  const user = await prisma.user.findFirst({
    where: { email: 'test@testcorp.com' }
  })

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isApproved: true }
    })
    console.log('User approved:', user.email)
  } else {
    console.log('User not found')
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)

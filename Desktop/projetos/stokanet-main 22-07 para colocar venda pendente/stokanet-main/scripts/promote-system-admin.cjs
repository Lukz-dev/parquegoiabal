/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { isSystemAdmin: true },
    orderBy: { createdAt: 'asc' },
  })

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        isApproved: true,
        isSystemAdmin: true,
        role: 'ADMIN',
      },
    })

    console.log(`PROMOTED ${existingAdmin.email}`)
    return
  }

  const fallbackUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'admin' } },
        { role: 'ADMIN' },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  if (fallbackUser) {
    await prisma.user.update({
      where: { id: fallbackUser.id },
      data: {
        isApproved: true,
        isSystemAdmin: true,
        role: 'ADMIN',
      },
    })

    console.log(`PROMOTED ${fallbackUser.email}`)
    return
  }

  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!firstUser) {
    console.log('NO_USERS_FOUND')
    return
  }

  await prisma.user.update({
    where: { id: firstUser.id },
    data: {
      isApproved: true,
      isSystemAdmin: true,
      role: 'ADMIN',
    },
  })

  console.log(`PROMOTED ${firstUser.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
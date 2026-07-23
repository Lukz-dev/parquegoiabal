import prisma from './lib/prisma.ts';

async function approveUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'test@testcorp.com' }
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isApproved: true }
    });
    console.log('User approved:', user.email);
  }
}

approveUser().catch(e => console.error(e)).finally(() => process.exit(0));

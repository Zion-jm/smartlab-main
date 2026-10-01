import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@smartlab.local' } });
    console.log(user);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();

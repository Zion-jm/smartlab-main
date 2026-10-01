import { Prisma, PrismaClient } from '@prisma/client';
import { RequestActionError } from './requestActionError';

// Retry only transactions PostgreSQL rolled back. Never put email or other
// external side effects inside this callback.
export async function inventoryTransaction<T>(prisma: PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
      if (attempt === 3) throw new RequestActionError(409, 'Inventory is busy. Refresh and try again.');
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1) + Math.floor(Math.random() * 20)));
    }
  }
}

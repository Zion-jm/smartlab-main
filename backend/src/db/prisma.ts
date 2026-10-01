import { PrismaClient } from '@prisma/client';

// One pool per API process. CLI scripts and isolated tests own their own clients.
// Transaction work must use its supplied tx, never this root client.
export const prisma = new PrismaClient();

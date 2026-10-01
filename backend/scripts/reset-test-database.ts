import 'dotenv/config';
import { assertDemoDatabase } from '../src/config/seedSafety';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Recreate a clean, realistic SmartLab test database.
 *
 * This command is deliberately guarded because it deletes all data in the
 * configured database:
 *
 *   RESET_TEST_DATABASE=1 npm run db:reset:test
 *
 * Run `npm run db:push` first when the database itself has not been created
 * yet. The existing prisma seed remains the source of realistic accounts,
 * academic directory records, rooms, and inventory.
 */
assertDemoDatabase(process.env);
const prisma = new PrismaClient();

async function resetDatabase() {
  if (process.env.RESET_TEST_DATABASE !== '1') {
    throw new Error(
      'Refusing to delete data. Re-run with RESET_TEST_DATABASE=1 when you intend to reset the test database.'
    );
  }

  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.labSchedule.deleteMany();
  await prisma.borrowRequestItem.deleteMany();
  await prisma.borrowRequest.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.facultyProfile.deleteMany();
  await prisma.adminProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();
  await prisma.building.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.program.deleteMany();
  await prisma.department.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.term.deleteMany();

  execFileSync(process.execPath, [require.resolve('ts-node/dist/bin.js'), require('node:path').resolve(__dirname, '../prisma/seed.ts')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
}

resetDatabase()
  .then(() => {
    console.log('✅ Test database reset and reseeded.');
  })
  .catch((error) => {
    console.error('❌ Test database reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
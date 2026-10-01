// Local development only. No credentials or row data are printed.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
async function main() {
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error('Invalid database configuration'); }
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/smartlab_test') throw new Error('This utility requires local smartlab_test.');
  const prisma = new PrismaClient();
  try {
    const bad = await prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM equipment WHERE "totalQuantity" < 0 OR "availableQuantity" < 0 OR "borrowedQuantity" < 0 OR "damagedQuantity" < 0 OR "totalQuantity"::bigint <> "availableQuantity"::bigint + "borrowedQuantity"::bigint + "damagedQuantity"::bigint');
    console.log('Inconsistent inventory rows:', bad[0].count);
    if (bad[0].count) throw new Error('Inventory review required; no rows or constraints were changed.');
    if (process.argv.includes('--apply')) {
      const sql = fs.readFileSync(require('path').join(__dirname, '../prisma/inventory-constraints.sql'),'utf8');
      // Execute both statements in one transaction, rolling back on validation failure.
      const split = sql.indexOf('ALTER TABLE equipment VALIDATE');
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(sql.slice(0, split));
        await tx.$executeRawUnsafe(sql.slice(split));
      });
      console.log('Inventory constraint installed and validated.');
    }
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Inventory check/apply failed. No automatic data repair was performed.'); process.exitCode = 1; });

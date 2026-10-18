const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'production';

const backendRoot = path.resolve(__dirname, '..');
// Launch the JS entry point directly: npm.cmd cannot be spawned without a shell on Windows.
const prismaCli = require.resolve('prisma/build/index.js');
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
});

if (migration.error) {
  console.error('Unable to start the database migration process:', migration.error.message);
  process.exit(1);
}

if (migration.status !== 0) {
  console.error(`Database migrations failed with exit code ${migration.status ?? 'unknown'}.`);
  process.exit(migration.status ?? 1);
}

require('../dist/server');

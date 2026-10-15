const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'production';

const workspaceRoot = path.resolve(__dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const migration = spawnSync(npmCommand, ['run', 'db:deploy'], {
  cwd: workspaceRoot,
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

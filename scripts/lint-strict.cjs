const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const eslint = path.join(path.dirname(require.resolve('eslint/package.json', { paths: [frontend] })), 'bin/eslint.js');
const result = spawnSync(process.execPath, [eslint, '.', '--max-warnings', '0', '--format', 'json'], {
  cwd: frontend, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.signal || result.status === null || result.status > 1) throw Error(result.stderr || 'ESLint execution failed');
const rows = JSON.parse(result.stdout);
if (!Array.isArray(rows)) throw Error('ESLint did not produce an array of results');
const out = process.env.SMARTLAB_EVIDENCE_DIR || path.join(root, 'artifacts/lint');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'lint-results.json'), JSON.stringify(rows, null, 2));
const errors = rows.reduce((total, row) => total + row.errorCount, 0);
const warnings = rows.reduce((total, row) => total + row.warningCount, 0);
console.log(`Strict lint: ${errors} errors, ${warnings} warnings.`);
process.exitCode = result.status || (errors || warnings ? 1 : 0);

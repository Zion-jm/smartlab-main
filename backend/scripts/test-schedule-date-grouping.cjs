const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/dateTime.ts'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {exports:exportsObject, Intl, Date});
for (const zone of ['Asia/Manila', 'UTC', 'America/Los_Angeles']) {
  process.env.TZ = zone;
  for (const key of ['2026-10-12', '2026-10-09']) {
    const iso = new Date(key + 'T00:00:00+08:00').toISOString();
    assert.notEqual(iso.slice(0, 10), key, 'Fixture must reproduce the old UTC grouping bug');
    assert.equal(exportsObject.dateToDateKey(iso), key);
    assert.equal(exportsObject.dateToDateKey(key), key);
  }
}
console.log('PASS: Oct 12 and Oct 9 remain on their Manila calendar dates in three host timezones.');

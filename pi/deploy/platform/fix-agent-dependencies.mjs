// The pinned SDK shrinkwrap overrides npm's lock/overrides. Replace only its
// external dependency used by Calendar's API; unused bundled CLI/RPC assets
// still need an upstream release and must not be used by Calendar.
import assert from 'node:assert/strict';
import { cpSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const sdk = join(root, 'node_modules/@earendil-works/pi-coding-agent');
const source = join(root, 'node_modules/brace-expansion');
const target = join(sdk, 'node_modules/brace-expansion');
const json = path => JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
function canonical(path) {
  assert.equal(realpathSync(path), path, 'Unexpected dependency path or symlink');
  assert.ok(lstatSync(path).isDirectory(), 'Expected a dependency directory');
  return path;
}
function files(path) {
  const result = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Dependency files must not be symlinks');
    if (entry.isDirectory()) result.push(...files(child));
    else { assert.ok(entry.isFile(), 'Expected a regular dependency file'); result.push(child); }
  }
  return result;
}
function sameModule() {
  const sourceFiles = files(source).map(path => relative(source, path)).sort();
  assert.deepEqual(files(target).map(path => relative(target, path)).sort(), sourceFiles, 'Incomplete brace-expansion replacement');
  for (const path of sourceFiles) assert.ok(readFileSync(join(source, path)).equals(readFileSync(join(target, path))), 'Mismatched brace-expansion contents');
}

canonical(sdk); canonical(source); canonical(target);
const sdkPackage = json(sdk);
assert.equal(sdkPackage.name, '@earendil-works/pi-coding-agent');
assert.equal(sdkPackage.version, '0.87.1', 'Reassess the upstream SDK before updating this remediation');
assert.equal(sdkPackage.main, './dist/index.js', 'Calendar must use the unbundled SDK');
assert.equal(sdkPackage.exports?.['.']?.import, './dist/index.js', 'Calendar must use the unbundled SDK');
assert.equal(json(source).name, 'brace-expansion');
assert.equal(json(source).version, '5.0.12', 'Install the pinned safe brace-expansion');
assert.equal(json(target).name, 'brace-expansion');
assert.ok(['5.0.9', '5.0.12'].includes(json(target).version), 'Unexpected SDK brace-expansion version');
const repair = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) && !process.argv.includes('--check');
if (repair && json(target).version === '5.0.9') {
  files(source);
  const staging = mkdtempSync(join(dirname(target), '.brace-expansion-'));
  try {
    cpSync(source, join(staging, 'module'), { recursive: true });
    rmSync(target, { recursive: true });
    renameSync(join(staging, 'module'), target);
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
assert.equal(json(target).version, '5.0.12', 'SDK dependency is unsafe; rerun npm ci with scripts enabled');
sameModule();

// npm install/prune can restore the SDK's shrinkwrapped lock entry even after
// replacing its installed files. Keep the audited lock aligned with the exact
// verified replacement, and make --check reject any later drift.
const lockPath = join(root, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const sourceEntry = lock.packages['node_modules/brace-expansion'];
const targetKey = 'node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion';
assert.equal(sourceEntry?.version, '5.0.12');
assert.ok(['5.0.9', '5.0.12'].includes(lock.packages[targetKey]?.version), 'Unexpected locked SDK brace-expansion version');
if (repair && JSON.stringify(lock.packages[targetKey]) !== JSON.stringify(sourceEntry)) {
  lock.packages[targetKey] = { ...sourceEntry };
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}
assert.deepEqual(lock.packages[targetKey], sourceEntry, 'Dependency lock is unsafe; rerun npm ci with scripts enabled');

const require = createRequire(join(sdk, 'package.json'));
const minimatchEntry = require.resolve('minimatch');
const minimatchRoot = canonical(join(sdk, 'node_modules/minimatch'));
assert.equal(json(minimatchRoot).version, '10.2.6');
assert.equal(minimatchEntry, join(minimatchRoot, 'dist/commonjs/index.js'));
assert.equal(createRequire(minimatchEntry).resolve('brace-expansion'), join(target, 'dist/commonjs/index.js'));
const esmEntry = join(minimatchRoot, 'dist/esm/index.js');
assert.equal(json(minimatchRoot).exports?.['.']?.import?.default, './dist/esm/index.js');
const esmBrace = execFileSync(process.execPath, ['--experimental-import-meta-resolve', '--input-type=module', '-e',
  "process.stdout.write(import.meta.resolve('brace-expansion', process.argv[1]));", pathToFileURL(esmEntry).href], { encoding: 'utf8' });
assert.equal(esmBrace, pathToFileURL(join(target, 'dist/esm/index.js')).href);
for (const implementation of [require('minimatch'), await import(pathToFileURL(esmEntry).href)]) {
  assert.equal(implementation.minimatch('src/calendar.ts', '{src,public}/*.ts'), true);
  assert.equal(implementation.minimatch('other/calendar.ts', '{src,public}/*.ts'), false);
}

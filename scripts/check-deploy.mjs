#!/usr/bin/env node
/* eslint-disable no-console */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const DIST_ROOT = join(process.cwd(), 'dist', 'spark-match-frontend');
const DIST_BROWSER = join(DIST_ROOT, 'browser');
const SOFT_LIMIT_KB = 500;
const HARD_LIMIT_KB = 1024;
const HASH_PATTERN = /-[A-Za-z0-9_-]{6,}\.(js|css)$/;
const HASH_EXEMPT = /(runtime|inline|polyfills)$/;

const SKIP_BUILD = argv.includes('--skip-build');

let hardErrors = 0;
let warnings = 0;

function ok(msg) { console.log(`[OK] ${msg}`); }
function warn(msg) { console.log(`[WARN] ${msg}`); warnings++; }
function fail(msg) { console.log(`[ERROR] ${msg}`); hardErrors++; }

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (!existsSync(DIST_ROOT) || !existsSync(DIST_BROWSER)) {
  if (SKIP_BUILD) {
    fail(`dist/spark-match-frontend (o browser/) no existe y se paso --skip-build.`);
    console.log(`\nResumen: ${hardErrors} hard errors, ${warnings} warnings.`);
    exit(1);
  }
  console.log('[INFO] dist no existe. Corriendo npm run build -- --configuration=production ...');
  try {
    execSync('npm run build -- --configuration=production', { stdio: 'inherit' });
  } catch (e) {
    fail(`npm run build fallo: ${e.message}`);
    console.log(`\nResumen: ${hardErrors} hard errors, ${warnings} warnings.`);
    exit(1);
  }
}

if (!existsSync(DIST_ROOT)) { fail(`No existe ${DIST_ROOT}`); exit(1); }
if (!existsSync(DIST_BROWSER)) { fail(`No existe ${DIST_BROWSER}`); exit(1); }
if (!existsSync(join(DIST_BROWSER, 'index.html'))) { fail(`Falta dist/spark-match-frontend/browser/index.html`); }
else { ok('browser/index.html presente (Angular 22 output)'); }

const files = walk(DIST_BROWSER);
const jsFiles = files.filter(f => f.endsWith('.js'));
const cssFiles = files.filter(f => f.endsWith('.css'));
const mapFiles = files.filter(f => f.endsWith('.map'));

if (mapFiles.length === 0) ok('sin sourcemaps .map en el output');
else fail(`${mapFiles.length} sourcemaps .map en el output (deben estar excluidos en prod)`);

for (const f of files) {
  const size = statSync(f).size;
  const kb = Math.round(size / 1024);
  if (size > HARD_LIMIT_KB * 1024) fail(`${f.replace(DIST_BROWSER + '\\', '')} pesa ${kb} KB (>${HARD_LIMIT_KB} KB)`);
  else if (size > SOFT_LIMIT_KB * 1024) warn(`${f.replace(DIST_BROWSER + '\\', '')} pesa ${kb} KB (>${SOFT_LIMIT_KB} KB)`);
}

const largestJs = jsFiles
  .map(f => ({ f, size: statSync(f).size }))
  .sort((a, b) => b.size - a.size)[0];
if (largestJs) {
  const kb = Math.round(largestJs.size / 1024);
  const rel = largestJs.f.replace(DIST_BROWSER + '\\', '');
  if (largestJs.size > SOFT_LIMIT_KB * 1024) warn(`chunk JS mas pesado: ${rel} = ${kb} KB (>${SOFT_LIMIT_KB} KB budget initial warn)`);
  else ok(`chunk JS mas pesado: ${rel} = ${kb} KB`);
}

const bundleFiles = [...jsFiles, ...cssFiles].filter(f => !HASH_EXEMPT.test(basename(f)));
const badHash = bundleFiles.filter(f => !HASH_PATTERN.test(basename(f)));
if (badHash.length === 0) ok(`todos los bundles .js/.css tienen hash (${bundleFiles.length} archivos)`);
else for (const f of badHash) fail(`bundle sin hash detectable: ${basename(f)}`);

const hasMainHashed = jsFiles.some(f => /^main-[A-Za-z0-9_-]{6,}\.js$/.test(basename(f)));
if (hasMainHashed) ok('main-<hash>.js presente');
else fail('main-<hash>.js ausente (verificar outputHashing="all" en angular.json)');

console.log(`\nResumen: ${hardErrors} hard errors, ${warnings} warnings.`);
if (hardErrors > 0) exit(1);
if (warnings > 0) exit(2);
exit(0);
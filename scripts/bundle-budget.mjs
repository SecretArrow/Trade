import { readdirSync, readFileSync, gzipSync } from 'node:fs';
import { join } from 'node:path';

const distDir = process.argv[2] ?? 'apps/web/dist';
const assetsDir = join(distDir, 'assets');
const ENTRY_LIMIT_KB = 250;
const TOTAL_LIMIT_KB = 450;

let files = [];
try {
  files = readdirSync(assetsDir);
} catch {
  console.error(`No assets directory found at ${assetsDir}. Did the build run?`);
  process.exit(1);
}

const jsFiles = files.filter((f) => f.endsWith('.js'));
const rows = [];
let total = 0;
for (const f of jsFiles) {
  const buf = readFileSync(join(assetsDir, f));
  const gz = gzipSync(buf).length;
  total += gz;
  rows.push({ file: f, raw: buf.length, gz });
}
const entry = rows.filter((r) => /^index-.*\.js$/.test(r.file)).reduce((sum, r) => sum + r.gz, 0);

rows.sort((a, b) => b.gz - a.gz);
console.log('| file | raw (B) | gz (B) |');
console.log('|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.file} | ${r.raw} | ${r.gz} |`);
}
const entryKb = (entry / 1024).toFixed(1);
const totalKb = (total / 1024).toFixed(1);
console.log(`Entry JS (gzipped): ${entryKb} KB (budget ${ENTRY_LIMIT_KB} KB)`);
console.log(`Total JS (gzipped): ${totalKb} KB (budget ${TOTAL_LIMIT_KB} KB)`);

if (entry > ENTRY_LIMIT_KB * 1024) {
  console.error('FAIL: entry JS bundle exceeds budget');
  process.exit(1);
}
if (total > TOTAL_LIMIT_KB * 1024) {
  console.error('FAIL: total JS bundles exceed budget');
  process.exit(1);
}
console.log('Bundle size budget OK');

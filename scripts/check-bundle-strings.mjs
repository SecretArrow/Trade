import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = process.argv[2] ?? 'apps/web/dist';

// Content-policy guard: the shipped bundle must not reference the private
// research material this project was specified from, nor contain any
// credential-like strings.
const banned = [
  'dropbox',
  'teknik break',
  'golden fairy',
  'fairy',
  'solscan',
  'ghp_',
  'github_pat_',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN OPENSSH PRIVATE KEY',
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(js|css|html|json|webmanifest|svg|txt|xml)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

let violations = 0;
try {
  for (const file of walk(distDir)) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const term of banned) {
      if (text.includes(term)) {
        console.error(`VIOLATION: '${term}' found in ${file}`);
        violations += 1;
      }
    }
  }
} catch (err) {
  console.error(`Could not scan ${distDir}: ${String(err)}`);
  process.exit(1);
}

if (violations > 0) {
  console.error(`FAIL: ${violations} banned string(s) found in the bundle`);
  process.exit(1);
}
console.log('Bundle content guard OK');

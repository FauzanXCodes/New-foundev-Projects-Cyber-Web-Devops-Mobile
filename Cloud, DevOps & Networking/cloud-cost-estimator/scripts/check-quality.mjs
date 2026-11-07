/**
 * Lightweight static quality gate, run as part of `npm run validate`.
 *
 * 1. Fails if application source (src/) contains leftover debug statements
 *    or unresolved work markers.
 * 2. Fails if index.html references a local asset that does not exist.
 *
 * This is intentionally dependency-free so it runs anywhere Node runs.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const problems = [];

// --- 1. Source hygiene ------------------------------------------------------

const FORBIDDEN = [
  { pattern: /\bconsole\.(log|debug)\b/, label: 'console.log/debug' },
  { pattern: /\bdebugger\b/, label: 'debugger statement' },
  { pattern: /\b(TODO|FIXME)\b/, label: 'unresolved TODO/FIXME' },
];

function collectJs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectJs(full, files);
    } else if (extname(full) === '.js') {
      files.push(full);
    }
  }
  return files;
}

for (const file of collectJs('src')) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(line)) {
        problems.push(`${file}:${index + 1} contains ${label}`);
      }
    }
  });
}

// --- 2. index.html local reference integrity --------------------------------

const html = readFileSync('index.html', 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

for (const ref of references) {
  if (/^(https?:|\/\/|#|mailto:|data:)/.test(ref)) {
    continue;
  }
  const path = ref.split(/[?#]/)[0];
  if (path && !existsSync(path)) {
    problems.push(`index.html references missing local asset: ${ref}`);
  }
}

// --- Report -----------------------------------------------------------------

if (problems.length > 0) {
  console.error('Quality check failed:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('Quality check passed (no debug statements, TODOs, or broken local references).');

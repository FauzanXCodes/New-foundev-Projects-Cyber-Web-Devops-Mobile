import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'test', 'scripts'];
const files = [];
const rootFiles = ['sw.js'];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (extname(fullPath) === '.js' || extname(fullPath) === '.mjs') {
      files.push(fullPath);
    }
  }
}

roots.forEach(walk);
files.push(...rootFiles);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax check passed for ${files.length} files.`);

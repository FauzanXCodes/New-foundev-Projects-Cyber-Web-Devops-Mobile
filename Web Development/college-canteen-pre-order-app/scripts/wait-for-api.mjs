import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'backend', 'package.json'));
require('dotenv').config({ path: path.join(root, 'backend', '.env') });

const port = Number(process.env.PORT || 4000);
const url = `http://127.0.0.1:${port}/api/health`;
const deadline = Date.now() + 60_000;
let announced = false;
let ready = false;

while (Date.now() < deadline) {
  if (!announced) {
    console.log(`Waiting for Campus Bite API and database at ${url}...`);
    announced = true;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (response.ok && health.ok && health.database === 'connected') {
      console.log('Campus Bite API and database are ready.');
      ready = true;
      break;
    }
  } catch {}

  await new Promise(resolve => setTimeout(resolve, 500));
}

if (!ready) {
  console.error(`Campus Bite API did not become ready at ${url}. Check the backend output above.`);
  process.exitCode = 1;
}

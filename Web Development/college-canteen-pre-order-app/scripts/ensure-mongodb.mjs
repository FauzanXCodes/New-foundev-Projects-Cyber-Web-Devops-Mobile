import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, readdir } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'backend', 'package.json'));
require('dotenv').config({ path: path.join(root, 'backend', '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_bite';
const target = new URL(uri);
const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

if (!localHosts.has(hostname)) {
  console.log('Using configured remote MongoDB; skipping local MongoDB startup.');
  process.exit(0);
}

const host = hostname === 'localhost' ? '127.0.0.1' : hostname;
const port = Number(target.port || 27017);

function isListening() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function findMongod() {
  if (process.env.MONGOD_PATH) {
    await access(process.env.MONGOD_PATH, constants.F_OK);
    return process.env.MONGOD_PATH;
  }
  if (process.platform !== 'win32') return 'mongod';

  const roots = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'MongoDB'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'MongoDB', 'Server')
  ].filter(Boolean);
  const candidates = [];
  for (const installRoot of roots) {
    let entries;
    try { entries = await readdir(installRoot, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))) {
      candidates.push(path.join(installRoot, entry.name, 'bin', 'mongod.exe'));
    }
  }
  for (const candidate of candidates) {
    try { await access(candidate, constants.F_OK); return candidate; } catch {}
  }
  throw new Error('MongoDB is not installed in the usual Windows location. Install MongoDB Community Server or set MONGOD_PATH.');
}

if (await isListening()) {
  console.log(`MongoDB is already available at ${host}:${port}.`);
  process.exit(0);
}

const binary = await findMongod();
const localDataRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
const dataDirectory = process.env.MONGODB_DATA_DIR || path.join(localDataRoot, 'MongoDB', 'data', 'db');
const logDirectory = process.env.MONGODB_LOG_DIR || path.join(localDataRoot, 'MongoDB', 'logs');
const logFile = path.join(logDirectory, 'mongod.log');
await Promise.all([mkdir(dataDirectory, { recursive: true }), mkdir(logDirectory, { recursive: true })]);

const child = spawn(binary, [
  '--dbpath', dataDirectory,
  '--bind_ip', host,
  '--port', String(port),
  '--logpath', logFile,
  '--logappend'
], { detached: true, stdio: 'ignore', windowsHide: true });
let spawnError;
let exitInfo;
child.once('error', error => { spawnError = error; });
child.once('exit', (code, signal) => { exitInfo = `exit code ${code ?? signal}`; });
child.unref();

const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  if (spawnError) throw new Error(`Could not start MongoDB: ${spawnError.message}`);
  if (exitInfo) throw new Error(`MongoDB stopped during startup (${exitInfo}). Check ${logFile}.`);
  if (await isListening()) {
    console.log(`Started local MongoDB at ${host}:${port}.`);
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 300));
}

throw new Error(`MongoDB did not become available at ${host}:${port} within 20 seconds. Check ${logFile}.`);

# EMTU Live Checker (bus-schedule-and-live-tracking) — Setup & Test Workflow

This project is **not a mobile app**. It is a Node.js WhatsApp bot named `emtu-live-checker` (`package.json` v1.0.0) that polls the EMTU bus API and pushes live vehicle positions and proximity alerts to WhatsApp over `whatsapp-web.js`. It also exposes a small Express health/status API. Automation is via Puppeteer driving a headless Chromium inside `whatsapp-web.js`, plus a `node-cron`-style interval loop for proximity polling. The scope of this document is the backend bot only: there is no mobile UI, no Flutter/React Native code, and `project-metadata.json` (which claims stack `Flutter; Node; MQTT` and a driver/student app goal) does not describe the code that is actually in this repository.

### 1. Prerequisites

| Requirement | Version / value | Verified on this machine (2026-10-22) | Notes |
| --- | --- | --- | --- |
| Node.js | 16+ per `README.md`; `package.json` declares no `engines` | `v22.15.0` present at `C:\Program Files\nodejs\node.exe` | Node 22 is not a tested target for this code; the README only claims 16+ |
| npm | ships with Node | `11.6.3` present | `npm ci` is **not** usable — there is no `package-lock.json` (see §5.2) |
| Chromium | downloaded automatically by `puppeteer` `^21.5.0` postinstall | not separately installed | Required for `whatsapp-web.js`; the Docker image uses the distro `chromium` package instead |
| WhatsApp account | a phone with WhatsApp installed, to scan the QR code | n/a | Session is persisted to `WHATSAPP_SESSION_PATH` |
| Git | any recent version | `2.51.2.windows.1` present | Only needed to clone/update the repo |
| Docker + Docker Compose | optional, for the `Dockerfile` / `docker-compose.yml` path | **NOT installed** | `docker --version` returns nothing on this machine |
| `curl` (optional) | for the health check examples | `curl.exe` available via Windows | See the PowerShell quoting note in §3.3 |

Working directory for every command below:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\bus-schedule-and-live-tracking"
```

### 2. Installation and Setup

#### 2.1 Repository state as shipped

`node_modules/` is **absent**, and so are `.env`, `logs/`, `data/`, and `sessions/`. `git ls-files` shows exactly these tracked files:

```
.env.example  .eslintrc.json  .gitignore  .prettierrc  Dockerfile  LICENSE  README.md
SETUP_COMPLETE.md  docker-compose.yml  docs/index.html  ecosystem.config.json  package.json
src/index.js  src/services/alertManager.js  src/services/emtu.js  src/services/whatsapp.js
src/utils/configManager.js  src/utils/logger.js  start.sh  tests/emtu-checker.test.js  tsconfig.json
```

Note: `SETUP_COMPLETO.md` is tracked by git but the file cannot be opened on this machine (it appears in directory listings but `ReadAllBytes`/`type` both report "file not found"). Treat its contents as unavailable.

#### 2.2 Install dependencies

```powershell
npm install
```

This is required — there is no vendored `node_modules`. Two things to expect:

- `puppeteer@^21.5.0` runs a postinstall that downloads a Chrome-for-Testing build (~150 MB) into the pnpm/npm cache. It needs outbound internet. On Windows this lands under `%USERPROFILE%\.cache\puppeteer`.
- No `package-lock.json` is committed, so `npm ci` cannot be used, and the `Dockerfile` (which runs `npm ci --only=production`) will fail at build time. See §5.2.

#### 2.3 Create the environment file and runtime directories

```powershell
Copy-Item -LiteralPath ".env.example" -Destination ".env" -Force
New-Item -ItemType Directory -Path "logs","data","sessions" -Force | Out-Null
```

`.env.example` is the authoritative list of supported variables. Every one of these is read by the code:

| Variable | `.env.example` value | Consumed at | Default when unset |
| --- | --- | --- | --- |
| `EMTU_API_BASE_URL` | `https://bustime.noxxonsat.com.br/portal?linha=` | `src/services/emtu.js:5` | `https://bustime.noxxonsat.com.br` |
| `WHATSAPP_SESSION_PATH` | `./sessions/whatsapp-session` | `src/services/whatsapp.js:13` | `./sessions/whatsapp-session` |
| `PORT` | `3000` | `src/index.js:60` | `3000` |
| `NODE_ENV` | `development` | `src/utils/logger.js:125` | unset |
| `CHECK_INTERVAL_MINUTES` | `1` | `src/index.js:376` | `1` (minutes) |
| `PROXIMITY_THRESHOLD_METERS` | `500` | `src/index.js:236` | `500` |
| `MAX_ALERTS_PER_ROUTE` | `5` | `src/index.js:237` | `5` |
| `DB_PATH` | `./data/emtu-checker.db` | `src/utils/configManager.js:8` (rewrites `.db` → `_config.json`) and `src/services/alertManager.js:8` (used verbatim as a JSON path) | `./data/configurations.json` / `./data/alerts.json` |
| `LOG_LEVEL` | `info` | `src/utils/logger.js:6` | `info` |
| `LOG_FILE` | `./logs/app.log` | `src/utils/logger.js:7` | `./logs/app.log` |

Two caveats to fix while editing `.env`:

- The `EMTU_API_BASE_URL` example value already ends in `/portal?linha=`, but `EMTUService.findRoute()` appends its own `/portal?linha=${routeNumber}` (`src/services/emtu.js:79`). With the example value verbatim the request URL becomes `.../portal?linha=/portal?linha=001`. Set `EMTU_API_BASE_URL=https://bustime.noxxonsat.com.br` (the code's own fallback) instead.
- `docker-compose.yml:14` references `EMTU_API_KEY`, which is **not** in `.env.example` and **not** read anywhere in `src/`. The code hardcodes a Basic-Auth header with the literal credentials `user`/`pass` (`src/services/emtu.js:11-13`).

`DB_PATH` is misleadingly named: nothing opens a SQLite database. `ConfigManager` stores monitoring configs as JSON at `DB_PATH` with `.db` replaced by `_config.json`, and `AlertManager` stores the alert log as JSON at `DB_PATH` verbatim.

#### 2.4 Optional: PM2 configuration

`ecosystem.config.json` is a ready-to-use PM2 app definition (`name: emtu-live-checker`, `script: src/index.js`, `instances: 1`, `exec_mode: fork`, `env: {NODE_ENV: production, PORT: 3000}`, logs to `./logs/pm2-*.log`). No edit is needed.

#### 2.5 Optional: Docker

`Dockerfile` is a `node:18-alpine` image that installs distro `chromium` plus `nss/freetype/harfbuzz/ttf-freefont`, sets `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`, creates `logs data sessions`, drops to a `nodeuser` (uid 1001), exposes `3000`, and runs `npm start`. Docker is **not installed on this machine**, and the build will additionally fail on the missing `package-lock.json` (see §5.2), so this path is currently blocked twice over.

### 3. Launch the Complete Project

#### 3.1 Ports summary

| Port | Protocol | Purpose | Source of truth |
| --- | --- | --- | --- |
| `3000` | HTTP | Express server: `GET /health`, `GET /status` | `src/index.js:44-63`, `PORT` in `.env` |
| `3000` | HTTP | Container → host mapping in `docker-compose.yml` | `docker-compose.yml:9` |
| `19000` | HTTP | Metro-style React Native dev server | **not used by this project** — no React Native code exists |

Only one port is needed. The Express server binds after `WhatsAppService.initialize()` resolves, so the port opens only after Puppeteer has launched Chromium.

#### 3.2 Start the bot (production mode)

```powershell
npm start
```

`npm start` → `node src/index.js` → `main()` → `EMTULiveChecker.initialize()`, which in order: launches the Puppeteer/WhatsApp client, starts the Express server, registers the message handler, and loads saved monitoring configurations.

**You must scan a QR code in the terminal to authenticate.** `src/services/whatsapp.js:56-61` renders it with `qrcode-terminal`; scan it with the WhatsApp mobile app (WhatsApp → Linked devices). Until the scan completes the client is not `ready`, and `sendMessage()` throws `WhatsApp client is not ready` (`src/services/whatsapp.js:124-126`). The session is then stored under `WHATSAPP_SESSION_PATH`, so subsequent starts should re-authenticate without a re-scan.

If the QR never appears, Chromium failed to launch — check the console output and the `./logs/app.log` file.

#### 3.3 Verify the HTTP surface (PowerShell)

Prefer the built-in cmdlets, which avoid all `curl` quoting problems:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/status" -Method Get | ConvertTo-Json
```

Expected shape of `/health` (`src/index.js:44-51`): `status` = `"running"`, `uptime` (seconds, float), `whatsappReady` (boolean), `activeMonitors` (number). Expected shape of `/status` (`src/index.js:53-58`): `monitoredRoutes` (array of route numbers), `configurations` (object of saved monitoring configs).

If you prefer `curl.exe`, note two Windows PowerShell 5.1 traps:

- `curl` is an alias for `Invoke-WebRequest` in Windows PowerShell 5.1. Call `curl.exe` explicitly or you will not be talking to curl at all.
- PowerShell's native-argument quoting can mangle a leading `@` in an argument. `curl` interprets `--data-binary "@file"` as "read the request body from this file", and PowerShell may strip or alter the quotes so curl no longer sees the `@`. Pass it with single quotes and run from the directory that holds the file:

```powershell
curl.exe -s "http://localhost:3000/health"
curl.exe -s -X POST -H "Content-Type: application/json" --data-binary '@payload.json' "http://localhost:3000/status"
```

#### 3.4 Development mode (auto-restart)

```powershell
npm run dev
```

`npm run dev` → `nodemon src/index.js`. Because the WhatsApp session is persisted to `sessions/`, a restart usually re-authenticates without a new QR code.

#### 3.5 PM2 mode

```powershell
npm install -g pm2
pm2 start ecosystem.config.json
pm2 logs emtu-live-checker
pm2 stop emtu-live-checker
```

`start.sh` also supports `./start.sh --pm2`, but `start.sh` is a Bash script (`#!/bin/bash`, uses `lsof`, `free`, `awk`) and will not run under plain PowerShell. On Windows use Git Bash or WSL, or invoke the npm/PM2 commands above directly.

#### 3.6 Docker mode (blocked)

```powershell
docker compose up -d          # docker-compose.yml: builds ., maps 3000:3000, mounts ./data ./logs ./sessions
docker compose logs -f emtu-live-checker
```

`docker compose up -d` will not work here: Docker is not installed, and `docker-compose.yml` also expects an `EMTU_API_KEY` environment variable that is not documented in `.env.example`. Its healthcheck is `["CMD", "curl", "-f", "http://localhost:3000/health"]`, but `curl` is not installed in the `node:18-alpine` base image, so the compose healthcheck will report unhealthy even if the app starts (the `Dockerfile`'s own `HEALTHCHECK` uses `node -e` instead and is fine).

### 4. Test the Project

#### 4.1 Scripts available

| Script | Command | Notes |
| --- | --- | --- |
| `start` | `node src/index.js` | production entry point |
| `dev` | `nodemon src/index.js` | watch mode |
| `test` | `jest` | Jest 29; no `jest` key in `package.json`, so Jest defaults apply (`testEnvironment: node`) |
| `lint` | `eslint src/` | ESLint 8 with `.eslintrc.json` (4-space indent, single quotes, semicolons, max-len 120 as a warning) |
| `format` | `prettier --write src/` | Prettier 3 with `.prettierrc` |

#### 4.2 Unit tests

```powershell
npm test
```

This runs `tests/emtu-checker.test.js` (Jest's default `testMatch` picks up `**/?(*.)+(spec|test).js`, and the file is named `*.test.js`). The suite has 15 test cases across 6 `describe` blocks. **I did not execute it** — the expectations below are read off the source, not from a run.

Expected results, derived by reading the code:

- **3 tests are expected to FAIL**, all in the `EMTU Service` block, for static reasons that do not depend on network or timing:
  - `should get mock routes when API is not available` calls `emtuService.getAllRoutes()`. `EMTUService` defines `getMockRoutes()` but has no `getAllRoutes` method → `TypeError: emtuService.getAllRoutes is not a function`.
  - `should find a route by number` calls `findRoute('001')` and asserts `route.number === '001'`. `findRoute()` returns `{ linhas: [...] }` (`src/services/emtu.js:77-87`), which has no `number` property, so the assertion sees `undefined`.
  - `should search routes` calls `emtuService.searchRoutes('terminal')`. No such method exists on `EMTUService` → `TypeError`.
- The remaining 12 tests (Alert Manager, Config Manager, Logger, Distance Calculation) reference methods that do exist (`shouldSendAlert`, `recordAlert`, `getAlertStatistics`, `getAlertHistory`, `clearAlertsForChat`, `saveConfiguration`, `getConfiguration`, `getActiveConfigurations`, `deactivateConfiguration`, `deleteAllConfigurations`, `formatMessage`, `shouldLog`, `calculateDistance`) and are expected to pass.
- The suite writes real files: `Logger`'s constructor calls `fs.ensureDir` on the log directory (`src/utils/logger.js:26`), `ConfigManager` writes `./data/configurations.json`, and `AlertManager` writes `./data/alerts.json`. Run it from the project root so those relative paths land in the right place.
- The `Distance Calculation` block does `require('../src/index')`, which transitively loads `whatsapp-web.js` and therefore `puppeteer`. The Chromium binary is not launched by the test, but the `puppeteer` package must be installed.
- `getVehiclePositions('001')` and `getStopLocation('stop_001')` do perform outbound HTTP to the EMTU endpoint, falling back to mock data on failure (`src/services/emtu.js:89-99`, `:190-209`). The assertions on those two only check `toBeDefined()`, so they pass either way.

#### 4.3 Lint and format

```powershell
npm run lint
npm run format
```

`npm run lint` only covers `src/` (not `tests/`, `start.sh`, or the config files). Expect pre-existing lint warnings: `no-unused-vars` is set to `warn`, `max-len` (120) is `warn`, and `src/index.js` contains several commented-out blocks and long template strings.

#### 4.4 Manual end-to-end smoke test (requires a real WhatsApp account)

Run `npm start`, scan the QR code, then send these to the bot number:

| Command | Expected behaviour |
| --- | --- |
| `/help` or `ajuda` | Bot replies with the Portuguese command list (`src/index.js:121-142`) |
| `/search 708` | Bot replies with matching lines; the content depends on the live EMTU API response |
| `/where 708BI2 ida` | Bot sends a WhatsApp *location* pin per vehicle plus a text summary (`src/index.js:144-205`) |
| `/monitor <line> <stop>` | Bot replies "✅ Monitoramento iniciado!" if both the route and the stop resolve; otherwise it replies with a not-found message and a `/search` hint |
| `/list` | Lists active monitorings for the chat |
| `/status` | Reports monitor count, alerts today, total alerts, uptime |
| `/stop <line>` | Stops one monitoring; `/stop` alone stops all for that chat |

The proximity alert itself is driven by `setInterval` at `CHECK_INTERVAL_MINUTES` minutes (`src/index.js:376`), so it will not fire immediately after `/monitor`. With the default `1` minute, allow at least one interval before concluding that alerts are broken.

#### 4.5 HTTP smoke test

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get | ConvertTo-Json
```

`status` should be `"running"`. `whatsappReady` should be `true` once the QR scan completes. A `false` there means the WhatsApp client is not authenticated yet, not that the server is broken.

### 5. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find module 'whatsapp-web.js'` | `npm install` was never run | Run `npm install` in the project root |
| `npm ci` fails with "can only install with an existing package-lock.json" | No `package-lock.json` is committed | Use `npm install`; do not use `npm ci` locally |
| `docker compose build` fails during `npm ci --only=production` | Same missing lockfile inside the image | Generate and commit a lockfile, or replace `npm ci` with `npm install --omit=dev` in the `Dockerfile` |
| Docker image reports unhealthy despite the app running | `docker-compose.yml` healthcheck shells out to `curl`, which is absent from `node:18-alpine` | Use the `Dockerfile`'s `HEALTHCHECK` (node-based) or add `curl` to the image |
| No QR code appears in the terminal | Chromium failed to launch under Puppeteer | Confirm `npm install` completed the Chromium download; check `PUPPETEER_EXECUTABLE_PATH`; inspect `./logs/app.log` |
| `WhatsApp client is not ready` when sending | The QR code has not been scanned yet | Scan the QR with the phone's WhatsApp app; wait for the `ready` event |
| Bot stops responding after a phone-side logout | The stored session under `sessions/` is stale | Delete the session folder and restart, then re-scan the QR |
| `EADDRINUSE` on start | Port `3000` is taken | Set a different `PORT` in `.env`, or stop the process holding it: `Get-NetTCPConnection -LocalPort 3000` |
| `/search` or `/where` returns "Nenhuma linha encontrada" | Wrong or doubled `EMTU_API_BASE_URL` (see §2.3) or the upstream API is unreachable | Use `EMTU_API_BASE_URL=https://bustime.noxxonsat.com.br`; the mock fallback in `src/services/emtu.js` only covers stops/vehicles/predictions, not route search |
| `EADDRINUSE`-free start but no alerts ever fire | `CHECK_INTERVAL_MINUTES` is long, or the bus is never within `PROXIMITY_THRESHOLD_METERS` | Lower `CHECK_INTERVAL_MINUTES` to `1` and `PROXIMITY_THRESHOLD_METERS` temporarily |
| Jest reports `emtuService.getAllRoutes is not a function` | The test file calls methods that do not exist on `EMTUService` | Expected pre-existing failure (§4.2); the fix is in the source or the test, not in the setup |
| `start.sh` fails immediately in PowerShell | It is a Bash script using `lsof`/`free` | Run it under Git Bash or WSL, or use the npm/PM2 commands from §3.2/§3.5 |

#### 5.1 Known limitations to state honestly

- **No `node_modules` and no lockfile.** `npm install` is mandatory; `npm ci` and the Docker build path are broken until a `package-lock.json` is produced.
- **Docker is not installed on this machine**, so the `Dockerfile` / `docker-compose.yml` path could not be exercised.
- **`SETUP_COMPLETE.md` is tracked by git but unreadable** on this filesystem (present in listings, "file not found" on read). Its instructions are unavailable and are not reproduced here.
- **No EMTU API key.** `.env.example` has no key field, `docker-compose.yml` references an `EMTU_API_KEY` that no code reads, and `src/services/emtu.js:11-13` hardcodes `user`/`pass` as Basic-Auth credentials. Whether the upstream API accepts them is unverified.
- **The `EMTU_API_BASE_URL` example value is wrong for the code** (`/portal?linha=` suffix plus the code's own `/portal?linha=` append).
- **The `DB_PATH` variable has nothing to do with SQLite.** Both consumers treat it as a JSON file path.
- **3 of the 15 Jest tests are expected to fail** against the current source (see §4.2). I did not run the suite, so this is a code-reading prediction, not an observed result.
- **WhatsApp Web is not an official API.** `whatsapp-web.js` drives an automated browser session; it can break when WhatsApp changes, and it violates WhatsApp's ToS for production use. It is also the reason the project needs a real phone scan and a Chromium download.
- **`docs/index.html` is a static landing page**, not the application entry point. The real entry is `src/index.js` (also `package.json` `main`).
- **`project-metadata.json` misdescribes this project** (claims Flutter/MQTT and a driver app). The repository contains no Flutter and no MQTT code.
- **This is not a mobile app.** There is no mobile client, no app store build, and no APK/IPA pipeline.

### 6. Verification Checklist

- [ ] `node --version` prints a version >= 16 (verified on this machine: `v22.15.0`).
- [ ] `npm --version` prints a version (verified on this machine: `11.6.3`).
- [ ] `npm install` completes and creates `node_modules/`.
- [ ] Puppeteer's Chromium download completed (no `Failed to set up browser` error in the install log).
- [ ] `.env` exists and `PORT`, `EMTU_API_BASE_URL`, `WHATSAPP_SESSION_PATH`, `CHECK_INTERVAL_MINUTES`, `PROXIMITY_THRESHOLD_METERS`, `MAX_ALERTS_PER_ROUTE`, `DB_PATH`, `LOG_LEVEL`, `LOG_FILE` are all set.
- [ ] `EMTU_API_BASE_URL` in `.env` does **not** include the `/portal?linha=` suffix.
- [ ] `logs/`, `data/`, and `sessions/` directories exist and are writable.
- [ ] `npm start` starts the process and the log shows `Server running on port 3000`.
- [ ] A WhatsApp QR code appears in the terminal and is scanned from the phone.
- [ ] `GET http://localhost:3000/health` returns JSON with `status: "running"`.
- [ ] `GET http://localhost:3000/health` eventually reports `whatsappReady: true`.
- [ ] `GET http://localhost:3000/status` returns JSON with `monitoredRoutes` and `configurations`.
- [ ] Sending `/help` to the bot returns the command list.
- [ ] Sending `/monitor <line> <stop>` returns a confirmation or a clearly-worded not-found message.
- [ ] `npm test` was executed and its result was recorded (expected: 3 pre-existing failures in the `EMTU Service` block — see §4.2).
- [ ] `npm run lint` was executed and its result was recorded.
- [ ] `npm run format` was executed and the diff was reviewed.
- [ ] `./logs/app.log` exists and is being written to.
- [ ] PM2 path verified (optional): `pm2 start ecosystem.config.json` and `pm2 logs emtu-live-checker`.
- [ ] Docker path verified (optional, currently blocked): `docker compose up -d` and `docker compose ps`.

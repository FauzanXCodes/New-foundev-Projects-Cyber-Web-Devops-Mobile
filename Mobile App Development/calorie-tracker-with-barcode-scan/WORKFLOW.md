# Dietinator (calorie-tracker-with-barcode-scan) — Setup & Test Workflow

Dietinator is a **real mobile app**: an Expo SDK 57 / React Native 0.86 calorie tracker (`package.json` name `dietinator`, `app.json` slug `dietinator`, version `1.15.2`, bundle id `com.personal.dietinator`) that also builds for web. It is local-first — diary entries live in an on-device SQLite database via `expo-sqlite`, and the only network dependency is an *optional* best-effort sync with the unofficial, reverse-engineered YAZIO API. The scope here covers the whole Expo project: the Metro dev server, the Jest unit suite, the Playwright web E2E suite, and the production web export. Native iOS/Android builds are described but flagged as platform-gated, and nothing in this document claims that any test was executed.

### 1. Prerequisites

| Requirement | Version / value | Verified on this machine (2026-10-22) | Notes |
| --- | --- | --- | --- |
| Node.js | `>=20.19.4` (`package.json` `engines`); `.nvmrc` pins `22` | `v22.15.0` present at `C:\Program Files\nodejs\node.exe` | Satisfied. The wrapper `scripts/expo-cli.cjs:24-26` hard-fails below 20.19.4 |
| pnpm | `11.22.0` (`packageManager` field) | **NOT installed** — `pnpm` is not on `PATH` | Blocker. See §2.1 |
| Corepack | any recent version | `0.32.0` present; `corepack pnpm@11.22.0 --version` prints `11.22.0` | Use Corepack to provision the pinned pnpm |
| Watchman | recommended on Windows | **NOT installed** | `metro.config.js:17` sets `config.resolver.useWatchman = true`; Metro falls back to the Node watcher with a warning |
| Git | any recent version | `2.51.2.windows.1` present | Needed to clone/update |
| Expo Go (or a dev build) | current Expo Go for SDK 57 | n/a | Needed to open the app on a physical phone via the QR code |
| Android SDK + JDK 17 | for `pnpm run android` | Android SDK 34.0.0 detected; `JAVA_HOME` = `Eclipse Adoptium jdk-17.0.8.101-hotspot` | Android licences are not accepted on this machine |
| Xcode 16+ | for `pnpm run ios` | **unavailable on Windows** | iOS builds require macOS |
| Playwright Chromium | for the E2E suite | not installed yet | Installed on demand by `pnpm run test:e2e:install` |

Working directory for every command below:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\calorie-tracker-with-barcode-scan"
```

### 2. Installation and Setup

#### 2.1 Provision pnpm (current blocker)

`pnpm` is not installed on this machine. The repo pins `pnpm@11.22.0` via `packageManager`, and `pnpm-workspace.yaml` carries pnpm-11-specific settings (`allowBuilds`, `minimumReleaseAgeExclude`, `patchedDependencies`, `publicHoistPattern`), so a different pnpm major will not behave the same.

```powershell
corepack enable
corepack prepare pnpm@11.22.0 --activate
pnpm --version     # expect 11.22.0
```

If Corepack's bundled signing keys are stale you may see `Cannot find suitable keyid`; the fallback is `npm install -g pnpm@11.22.0`.

#### 2.2 Install dependencies

```powershell
pnpm install
```

`node_modules/` is **absent** in this checkout, so this step is mandatory. Expect:

- The `postinstall` script runs `node scripts/build-sqlite-worker.mjs`, which uses `esbuild@0.28.2` to bundle `node_modules/expo-sqlite/web/worker.ts` into `public/worker.js` plus a `wa-sqlite` `.wasm` asset. Both outputs are gitignored.
- `pnpm-workspace.yaml` applies `patchedDependencies: expo-sqlite@57.0.2: patches/expo-sqlite@57.0.2.patch`. The patch is applied by pnpm at install time.
- `publicHoistPattern: ["*"]` keeps a flat `node_modules`, which the Metro config depends on.
- `husky` installs the `.husky/pre-commit` and `.husky/pre-push` git hooks (the `prepare` script).

For a CI-identical install use `pnpm install --frozen-lockfile` (what `.github/workflows/ci.yml` does).

#### 2.3 Environment variables

`.env.example` is the authoritative list. It says to copy it to `.env.local`:

```powershell
Copy-Item -LiteralPath ".env.example" -Destination ".env.local" -Force
```

| Variable | In `.env.example` | Used by | Required? |
| --- | --- | --- | --- |
| `YAZIO_EMAIL` | empty | `e2e/yazio.spec.ts`, `e2e/servings.spec.ts`, `e2e/calorie.spec.ts` (each calls `test.skip(...)` when unset) | No — only for the real-account E2E specs |
| `YAZIO_PASSWORD` | empty | same three E2E specs | No — same |
| `MCP_API_KEY` | commented out | `scripts/mcp-server.cjs:1184` — the `/mcp` endpoint requires it when `NODE_ENV=production` | No for local dev; effectively yes in production |

Important detail: the **app itself never reads these variables**. `grep` over `src/` and `app/` finds no `process.env` access at all — YAZIO login in the app is entered through the UI (`app/login.tsx` → `src/services/yazio/client.ts` → `src/services/yazio/auth-storage.ts`). `YAZIO_EMAIL`/`YAZIO_PASSWORD` are only consumed by Playwright, which loads them via `process.loadEnvFile(".env.local")` in `playwright.config.ts:14-18`.

`.env` and `.env*.local` are both in `.gitignore` (lines 34 and 49) and CI runs a gitleaks scan. `git ls-files` currently tracks **only** `.env.example` (312 tracked files total), so there is no committed secret in the repository today. The risk is prospective only: never `git add -f` a `.env`/`.env.local`.

#### 2.4 Optional: Playwright browser

```powershell
pnpm run test:e2e:install
```

That runs `playwright install chromium`. It is a prerequisite for `pnpm run test:e2e` and is a separate step from `pnpm install` on purpose.

### 3. Launch the Complete Project

#### 3.1 Ports summary

| Port | Protocol | Purpose | Source of truth |
| --- | --- | --- | --- |
| `9082` | HTTP | Metro / Expo dev server (`start`, `dev`, `android`, `ios`, `web`, `dev:web`) | `package.json` scripts — every one passes `--port 9082` |
| `8082` | HTTP | Production web export served by `scripts/serve-dist.mjs` | `scripts/serve-dist.mjs:23` (`PORT` env, default `8082`) |
| `8082` | HTTP | Playwright `baseURL` and the E2E `webServer` port | `playwright.config.ts:11`, `:31` |
| `19000` | HTTP | Not used | no reference in this repo's config |

`9082` is deliberate: the README states it "avoids Windows Hyper-V collisions on `8081`". Override it with `pnpm start -- --port 9090`.

#### 3.2 Start the dev server (Metro + Expo)

```powershell
pnpm start
```

`pnpm start` → `node scripts/expo-cli.cjs start --port 9082`. The wrapper does three things before delegating to `expo/bin/cli`:

1. `require("./polyfill-os.cjs")` — backfills `os.availableParallelism()` for Metro 0.83+.
2. Re-spawns itself with `--max-old-space-size=8192` if no heap limit is already set (`scripts/expo-cli.cjs:9-20`), because the web bundle can OOM at Node's default ~2 GB heap.
3. Enforces the Node >= 20.19.4 gate and prints a specific error if the npm package named `node` is shadowing the real runtime.

Do not use `npx expo` directly — the wrapper's heap bump and `os` polyfill are both required.

Metro then serves on `http://localhost:9082` and prints a QR code for Expo Go.

#### 3.3 Run the web target

```powershell
pnpm run web        # Metro dev server, web bundle, port 9082
pnpm run dev:web    # identical command
```

The dev server also hosts two extra middlewares installed by `metro.config.js:98-175`: a `/api/yazio/*` reverse proxy to `https://yzapi.yazio.com/v15` (to dodge CORS) and the local MCP/agent bridge. It also sets `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opender-Policy: same-origin`, which `wa-sqlite` needs for `SharedArrayBuffer`.

`metro.config.js:17` sets `useWatchman = true`, and `metro.config.js:24-30` caps `maxWorkers` to 2 on Windows because of the per-process file-handle limit (the repo has ~460k files). Watchman is not installed here, so Metro will fall back to the Node watcher and may be slow to start — this is a known pain point the config comments call out explicitly.

#### 3.4 Production web build and serve

```powershell
pnpm run build:web   # scripts/build-sqlite-worker.mjs -> expo export --platform web -> scripts/fix-web-build.mjs -> dist/
pnpm run serve:web   # serves dist/ on http://localhost:8082 with COEP/COOP + the YAZIO proxy
pnpm run web:prod    # build:web then serve:web
```

`scripts/serve-dist.mjs` exits with `No web build found at <path>` if `dist/` does not exist, so `build:web` must run first.

#### 3.5 Run on a device or emulator

```powershell
pnpm run android    # node scripts/expo-cli.cjs start --android --port 9082
pnpm run ios        # node scripts/expo-cli.cjs start --ios --port 9082
```

`pnpm run ios` requires macOS with Xcode. `pnpm run android` requires the Android SDK plus accepted licences (`flutter doctor` on this machine reports "Some Android licenses not accepted"). Barcode scanning uses `expo-camera`; `AGENTS.md` and `README.md` both state it works on device or in a dev build and is *limited on web* — verify before assuming the scan flow works in a browser.

#### 3.6 Demo mode

`/?demo=1` loads sample data with no account (`src/services/demo.ts`), which is the quickest way to see the app working without a YAZIO login.

### 4. Test the Project

#### 4.1 Script reference (all from `package.json`)

| Script | Command | Purpose |
| --- | --- | --- |
| `start` / `dev` | `node scripts/expo-cli.cjs start --port 9082` | Metro + Expo |
| `android` / `ios` / `web` / `dev:web` | same wrapper with `--android` / `--ios` / `--web` and `--port 9082` | platform targets |
| `typecheck` | `tsc --noEmit` | TypeScript, `strict: true` |
| `lint` | `eslint .` | ESLint 9 flat config (`eslint.config.js`, `eslint-config-expo`) |
| `format` | `prettier --write .` | Prettier 3 + `prettier-plugin-tailwindcss` |
| `format:check` | `prettier --check .` | read-only, used by CI |
| `test` | `jest` | unit tests, no coverage gate |
| `test:coverage` | `jest --coverage --runInBand` | unit tests + coverage thresholds |
| `test:e2e` | `npm run build:web && playwright test` | full production build then Playwright |
| `test:e2e:quick` | `npm run build:web:quick && playwright test` | dev-mode export, faster |
| `test:e2e:dev` | `cross-env PW_E2E_DEV=1 playwright test` | Playwright against a dev server |
| `test:e2e:headed` | `npm run build:web && playwright test --headed` | visible browser |
| `test:e2e:yazio` | `npm run build:web && playwright test e2e/yazio.spec.ts` | real-account spec only |
| `test:e2e:install` | `playwright install chromium` | one-time browser download |
| `build:web` / `build:web:quick` / `build:web:dev` | worker build + `expo export --platform web` (+ fix) | web exports |
| `serve:web` | `node scripts/serve-dist.mjs` | static server for `dist/` |
| `web:prod` / `web:quick` | build + serve | combined |
| `test:mcp` | `node scripts/mcp-agent-check.mjs` | MCP/agent bridge check |
| `screenshots` | `node scripts/capture-screenshots.mjs` | screenshot capture |
| `release` | `node scripts/release.cjs` | version bump + commit + tag |
| `postinstall` / `build:worker` | `node scripts/build-sqlite-worker.mjs` | esbuild the expo-sqlite web worker |

#### 4.2 Unit tests (Jest + jest-expo)

```powershell
pnpm test
```

Jest config lives inline in `package.json`:

- `preset: "jest-expo"`
- `testMatch: ["**/__tests__/**/*.test.(ts|tsx|js|jsx)"]`
- `testPathIgnorePatterns: ["/node_modules/", "/e2e/", "/dist/", "/android/"]`
- `coverageThreshold.global`: statements 75, branches 60, functions 70, lines 75

There are **44 unit test files** matching that `testMatch`: `src/utils/__tests__` (15), `src/db/__tests__` (10), `src/services/__tests__` (6), `src/services/ai/__tests__` (4), `src/components/__tests__` (3), `src/theme/__tests__` (2), `scripts/__tests__` (2), `src/services/yazio/__tests__` (1), `src/hooks/__tests__` (1).

`pnpm test` runs **without** `--coverage`, so the thresholds are not enforced and the command's exit code depends only on test results. `pnpm run test:coverage` **will fail the run** if global coverage falls below the thresholds above — a threshold failure there is not necessarily a broken test.

**I did not run the suite.** What can be stated from the code:

- The unit suite is designed to be hermetic: `src/db/__tests__` uses a mocked DB, and `src/utils/__tests__` covers pure helpers (`date`, `nutrients`, `units`, `retry`, `barcode`, `color`, `adherence`, `swipe`, `secure-storage`).
- `scripts/__tests__/mcp-http.test.js` mutates `process.env.MCP_API_KEY` and asserts that `/mcp` rejects requests without a key. It is a Node-side test, not a React Native one.
- `src/components/__tests__` uses `@testing-library/react-native` (declared as a devDependency) with the `jest-expo` preset.
- The e2e directory is excluded from Jest by `testPathIgnorePatterns`, so `pnpm test` never touches Playwright specs.

#### 4.3 Typecheck and lint

```powershell
pnpm run typecheck    # tsc --noEmit, strict: true
pnpm run lint         # eslint . (flat config; ignores dist/*, android/*, node_modules/*, .expo/*, playwright-report/*, test-results/*, public/worker.js, public/*.wasm)
pnpm run format:check # prettier --check .
```

`tsconfig.json` extends `expo/tsconfig.base` with `strict: true` and path aliases `@/* -> ./src/*`, `@ui/* -> ./components/ui/*`, and `tailwind.config`. The path aliases are what let `AGENTS.md`'s `@ui/button` / `@/components/...` imports resolve.

#### 4.4 End-to-end tests (Playwright, web target)

```powershell
pnpm run test:e2e:install   # once: download Chromium
pnpm run test:e2e           # build dist/, then run the suite against it
```

`playwright.config.ts` details:

- `testDir: "./e2e"`, `workers: 1`, `fullyParallel: false` (the suite shares one server and each boot is heavy).
- `timeout: 90_000`, `expect.timeout: 15_000`.
- `use.baseURL: "http://localhost:8082"`, `viewport: {width: 390, height: 844}`, `deviceScaleFactor: 2` — phone dimensions.
- `webServer` (non-dev mode): `node scripts/serve-dist.mjs`, port `8082`, `reuseExistingServer: true`, 30 s startup timeout.
- `webServer` (dev mode, `PW_E2E_DEV=1`): `node scripts/expo-cli.cjs start --web --port 8082`, 180 s startup timeout. Note this is port **8082**, whereas `pnpm run dev:web` serves on **9082** — with `reuseExistingServer: true`, Playwright starts its own dev server on 8082 if nothing is listening there.

There are **11 spec files** in `e2e/`: `boot`, `calorie`, `calorie-swipe`, `diary`, `search`, `servings`, `stats`, `ai-smoke`, `demo-backup`, `ui-geometry`, `yazio` (plus the shared `helpers.ts`).

Three of them (`calorie.spec.ts`, `servings.spec.ts`, `yazio.spec.ts`) call `test.skip(...)` unless `YAZIO_EMAIL` and `YAZIO_PASSWORD` are set, so they are skipped without credentials. The rest are designed to run offline: `e2e/boot.spec.ts` seeds `localStorage["calorie_tracker_yazio_logged_in"] = "1"` to skip the login screen and asserts that "Breakfast", "Lunch", and "Dinner" are visible. These are the assertions the CI job relies on (`.github/workflows/ci.yml` runs `pnpm run test:e2e` with no credentials at all).

**I did not run the E2E suite.** From the config and specs, the expected observable behaviour of `pnpm run test:e2e` is: a `dist/` build succeeds, `scripts/serve-dist.mjs` starts on `8082`, and the non-YAZIO specs execute against a phone-sized viewport with the three YAZIO specs reported as skipped.

#### 4.5 Manual smoke test (the order given by `AGENTS.md`)

1. Log in (or use `/?demo=1`).
2. Search for a food.
3. Add an entry.
4. Check the dashboard.
5. Sync, if online.
6. Add an offline entry using a cached food.
7. Scan a barcode on device.

Steps 5 and 7 need a real YAZIO account and a physical device respectively; the rest work with no account.

### 5. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `pnpm : The term 'pnpm' is not recognized` | pnpm is not installed on this machine | `corepack enable` then `corepack prepare pnpm@11.22.0 --activate` (§2.1) |
| `Cannot find suitable keyid` from Corepack | Corepack's bundled npm signing keys are outdated | `npm install -g pnpm@11.22.0` |
| `Node 22.x is below Expo SDK 56 minimum (20.19.4)` | Old Node on `PATH` | `node --version`; use Node 22 (`.nvmrc`). Note `nvm` is not installed on this machine |
| "The npm package named `node` in your home folder is shadowing real Node.js" | The npm package `node` is installed globally | `cd $env:USERPROFILE` then `npm uninstall node`; the wrapper prints this exact instruction |
| Metro dies with "heap out of memory" or the progress bar stalls at 0 % | Node's default ~2 GB heap is too small for this bundle | Already handled by `scripts/expo-cli.cjs` (re-spawns at 8 GB). If you bypassed the wrapper, add `NODE_OPTIONS=--max-old-space-size=8192` |
| Metro watch crawl times out on Windows | Watchman is not installed, so Metro uses the slow Node watcher | Install Watchman, or accept the slower start; `metro.config.js` already caps `maxWorkers` to 2 on Windows |
| `EMFILE` / "too many open files" during the Metro crawl | Per-process file-handle limit with a deep pnpm `node_modules` | Already mitigated by `publicHoistPattern: ["*"]` and `maxWorkers = 2` on Windows |
| `No web build found at <path>` from `serve-dist.mjs` | `dist/` does not exist | Run `pnpm run build:web` first |
| E2E fails with `ECONNREFUSED` on `localhost:8082` | The server did not start in time | `pnpm run build:web` then `pnpm run serve:web` in a separate terminal and confirm it prints the URL |
| E2E specs are reported as skipped | `YAZIO_EMAIL` / `YAZIO_PASSWORD` are not set | Expected for `calorie`, `servings`, `yazio` specs; add them to `.env.local` to enable |
| `SQLite` / `SharedArrayBuffer` errors in the browser | Missing cross-origin isolation headers | The dev middleware and `serve-dist.mjs` both set COEP/COOP; do not serve `dist/` with a plain static server |
| `pnpm run test:coverage` exits non-zero | Global coverage below the `package.json` thresholds (75/60/70/75) | Add tests for the uncovered pure logic, or read the coverage report before assuming a test failed |
| `pnpm run android` fails to find a device | Android licences not accepted on this machine | `flutter doctor --android-licenses` (this repo does not ship the Android SDK, but the machine's Flutter does) |
| `pnpm run ios` fails immediately | iOS builds require macOS + Xcode | Use `pnpm run web`, or build the APK via `.github/workflows/release.yml` |
| Barcode scan does nothing in the browser | `expo-camera` is limited on web | Test on a device or a dev build |
| `pnpm install` fails on the `expo-sqlite` patch | `patches/expo-sqlite@57.0.2.patch` did not apply | Re-run `pnpm install`; confirm `pnpm-workspace.yaml` `patchedDependencies` is intact |

#### 5.1 Known limitations to state honestly

- **pnpm is not installed on this machine.** `pnpm install` (and therefore every `pnpm run …` script) cannot run until §2.1 is done. This is the primary blocker for this project.
- **`node_modules/` is absent.** Nothing in this project has been built or executed in this checkout.
- **Watchman is not installed**, while `metro.config.js:17` explicitly enables it for Windows performance. Metro falls back to the Node watcher; start-up will be slow and the config comments warn the crawl can outrun Metro's 4-minute timeout.
- **`nvm` is not installed** on this machine, so `.nvmrc` cannot be applied via `nvm use`. The system-wide Node `v22.15.0` already satisfies the `>=20.19.4` engine constraint.
- **No committed secrets.** `git ls-files` lists only `.env.example` among env files; `.env` and `.env*.local` are gitignored and gitleaks runs in CI. `YAZIO_EMAIL`/`YAZIO_PASSWORD` are only consumed by Playwright — the app authenticates through the UI. The risk is only that a developer force-adds a local env file.
- **YAZIO is an unofficial, reverse-engineered API.** It can change without notice; `AGENTS.md` states the app is for personal use only and must not redistribute YAZIO access.
- **iOS builds are macOS-only** and cannot be done on this Windows machine.
- **Android SDK licences are unaccepted** on this machine, so the Android target cannot be built until that is fixed.
- **Barcode scanning is limited on web** — the full scan flow needs a device or dev build.
- **`/mcp` requires `MCP_API_KEY` in production.** `scripts/mcp-server.cjs:1184` requires the key whenever `NODE_ENV=production`, even if the variable is unset.
- **`AGENTS.md` references `.devcontainer/devcontainer.json`**, but there is no `.devcontainer/` directory in this repository.
- **`AGENTS.md` describes `pnpm run test:e2e:dev` as "Playwright against a running `pnpm run dev:web`"**, but `dev:web` serves on `9082` while the Playwright dev `webServer` uses `8082`. Playwright will start its own server on `8082` unless one is already listening there.
- **No test in this repository was executed for this document.** All expected outcomes above are derived from reading `package.json`, `playwright.config.ts`, `metro.config.js`, the scripts, and the spec files.
- **The `dist/` web export, `public/worker.js`, and `public/wa-sqlite-*.wasm` do not exist** in the checkout; they are build artifacts.

### 6. Verification Checklist

- [ ] `node --version` prints `v22.x` (verified on this machine: `v22.15.0`).
- [ ] `pnpm --version` prints `11.22.0` (requires `corepack enable` + `corepack prepare pnpm@11.22.0 --activate`).
- [ ] `pnpm install` completes and creates `node_modules/`.
- [ ] `public/worker.js` and `public/wa-sqlite-*.wasm` were generated by the `postinstall` script.
- [ ] `patchedDependencies` for `expo-sqlite@57.0.2` was applied (pnpm reports no patch error).
- [ ] `.env.local` exists with `YAZIO_EMAIL` / `YAZIO_PASSWORD` (optional) and `MCP_API_KEY` (optional).
- [ ] `git ls-files` confirms no `.env` or `.env.local` is tracked.
- [ ] `pnpm run typecheck` was executed and its result was recorded.
- [ ] `pnpm run lint` was executed and its result was recorded.
- [ ] `pnpm run format:check` was executed and its result was recorded.
- [ ] `pnpm test` was executed and its result was recorded (44 unit test files, no coverage gate).
- [ ] `pnpm run test:coverage` was executed and its result was recorded (coverage thresholds 75/60/70/75 enforced).
- [ ] `pnpm run test:e2e:install` completed and Playwright Chromium is present.
- [ ] `pnpm run build:web` produced `dist/` with `index.html`.
- [ ] `pnpm run serve:web` prints `Dietinator web build served at http://localhost:8082`.
- [ ] `pnpm run test:e2e` was executed and its result was recorded (11 spec files; 3 YAZIO specs expected to skip without credentials).
- [ ] `pnpm start` starts Metro on `http://localhost:9082` and prints an Expo QR code.
- [ ] The app opens in Expo Go on a phone, or in a browser via `pnpm run web`.
- [ ] Demo mode verified: `/?demo=1` loads sample data without an account.
- [ ] Local-first path verified: an entry can be added with no network access.
- [ ] Barcode scan verified on a device or dev build (web is limited).
- [ ] Android target built (optional): `pnpm run android` after `flutter doctor --android-licenses`.
- [ ] iOS target built (optional, macOS only): `pnpm run ios`.

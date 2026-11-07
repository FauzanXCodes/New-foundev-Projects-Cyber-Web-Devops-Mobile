# Mobile App Development — Refinement Report

**Domain:** `Domain/Mobile App Development/`
**Projects discovered:** 12
**WORKFLOW.md files created:** 12 / 12 (each with the 6 required `###` sections and fully unchecked `- [ ]` checklists)
**Date of work:** 2026-10-22
**Scope discipline:** read-only audit of all 12 projects; **minimal, targeted repairs only where a project was genuinely broken**; no rebuilds of working apps; no commits, no pushes, no deploys.

> **Honesty statement.** Every defect below was produced by running real tooling on this machine
> (`node --check`, a static import/export cross-check, `flutter pub get`, `flutter analyze`, file byte
> inspection). No test output, build output or command result in this report was fabricated. Where a check
> could not be run (missing toolchain / wrong SDK / macOS-only), it is recorded as a **blocker**, not a pass.

---

## 1. Executive summary

| Metric | Count |
|---|---|
| Projects discovered | 12 |
| `WORKFLOW.md` created | 12 |
| Real Android/iOS mobile apps | 3 (`calorie-tracker…`, `student-buy-sell…`, and the Flutter apps below — see §3) |
| Real Flutter apps (Android-capable) | 3 (`campus-carpool-app`, `campus-navigation-app`, `offline-first-note-app-with-sync`) |
| Expo/React Native apps | 2 (`calorie-tracker-with-barcode-scan`, `fitness-challenge-with-friends`) |
| Full-stack web apps (not native) | 2 (`event-ticketing-and-check-in-app`, and the web target of the Expo apps) |
| Native iOS SwiftUI apps | 1 (`student-buy-sell-marketplace-app`) |
| **Not mobile at all** | 5 (`bus-schedule…` Node bot, `flashcards…` Chrome ext + PHP, `language-learning…` Dart CLI, `plant-disease-identifier` Python desktop GUI, `voice-memo-app…` macOS app) |
| Projects with genuine code defects found | 1 (`event-ticketing-and-check-in-app` backend) |
| Projects repaired | 1 (`event-ticketing-and-check-in-app`) |
| Files modified by this task | 5 (all in `event-ticketing-and-check-in-app/backend`) |
| `.bak` safety backups created | 5 |
| Blocked-on-environment items | many (see §5) |

---

## 2. Method

1. **Deep audit (read-only).** Each project was opened and its real stack determined from manifests
   (`pubspec.yaml`, `package.json`, `project.yml`, `requirements.txt`, `manifest.json`, Xcode project),
   entry points, routes, env files and READMEs — **not** from `project-metadata.json`, which was found to be
   aspirational and unreliable across the domain.
2. **Static analysis that can run without installing anything:**
   - `node --check` on every non-JSX `.js` file, honouring each package's `"type": "module"` / CJS mode
     (copied to a temp `.mjs`/`.cjs` so the mode is correct);
   - a custom **named import/export cross-check** across the `event-ticketing` backend (resolves every
     relative `import { … }` against the target file's actual exports);
   - `flutter pub get` + `flutter analyze` for the 3 Flutter projects.
3. **Targeted repair** only for unambiguous defects (see §4), with a `.bak` copy taken before each edit and a
   re-verification after.
4. **WORKFLOW.md authoring** for all 12 projects, Windows-first PowerShell, honest blockers.

---

## 3. Per-project results

Legend — **Type**: what the code *actually* is. **WORKFLOW.md**: created. **Refinement**: changes made by this task.

### 3.1 `bus-schedule-and-live-tracking`
- **Type:** **Not mobile** — Node.js WhatsApp bot (`emtu-live-checker`) using `whatsapp-web.js` + Puppeteer, with an Express server.
- **WORKFLOW.md:** created (20 checklist items).
- **Refinement:** none.
- **Findings:** no `node_modules`; **no `package-lock.json`**, so `npm ci` and the `Dockerfile` build fail; Docker not installed; `EMTU_API_BASE_URL` example double-appends `/portal?linha=`; `EMTU_API_KEY` referenced by compose but read nowhere; a couple of Jest tests reference functions (`getAllRoutes`, `searchRoutes`) that do not exist.
- **Blockers:** requires `npm install` (pulls Chromium for Puppeteer) and a WhatsApp QR scan to run.

### 3.2 `calorie-tracker-with-barcode-scan`
- **Type:** **Real mobile** — Expo SDK 57 / React Native 0.86, expo-router, `expo-sqlite`; also a real web target.
- **WORKFLOW.md:** created (23 items).
- **Findings:** uses **pnpm** (`pnpm-workspace.yaml`) — pnpm not installed (corepack shim works); no `node_modules`; Watchman not installed while `metro.config.js` sets `useWatchman = true`; dev server pinned to port **9082**, `serve-dist`/Playwright to **8082**; YAZIO integration is an unofficial reverse-engineered API; iOS is macOS-only.
- **Secret check:** `git ls-files` shows **only `.env.example`** — **no committed secrets**.
- **Refinement:** none.

### 3.3 `campus-carpool-app`
- **Type:** **Real mobile** — Flutter package `myapp1`; entry `lib/main.dart` → `CollegeCarpoolApp`.
- **WORKFLOW.md:** created (18 items).
- **Findings:** uses `flutter_map` + OpenStreetMap (metadata claims Google Maps — wrong). `pubspec.yaml` requires Dart SDK `^3.10.1`.
- **Blocker (verified):** `flutter pub get` fails on the installed Flutter **3.35.2 / Dart 3.9.0** —
  *"Because myapp1 requires SDK version ^3.10.1, version solving failed… Try using the Flutter SDK version: 3.47.7."*
  A newer Flutter is required. `flutter analyze` is therefore meaningless here (no `.dart_tool`), and its
  "Target of URI doesn't exist" output is spurious — documented as such.
- **Refinement:** none.

### 3.4 `campus-navigation-app`
- **Type:** **Real mobile** — legacy Flutter 2.x app (package `flutter_maps`), Android + iOS. The **only** project here that genuinely uses `google_maps_flutter`.
- **WORKFLOW.md:** created (27 items).
- **Blocker (verified):** `flutter pub get` fails on Flutter 3.35.2 because pre-null-safety deps
  (`cupertino_icons ^0.1.3`, `sdk <3.0.0`) are forbidden. Needs a much older Flutter SDK or a migration.
- **Findings:** legacy `RaisedButton`, `File()` asset load and `late Marker` will fail at runtime on modern Flutter; real Maps keys are committed (not reproduced in the doc).
- **Refinement:** none.

### 3.5 `event-ticketing-and-check-in-app`  ← **the one repaired project**
- **Type:** **Full-stack web** — `backend/` (Node/Express + MongoDB + Socket.IO, ESM) + `Frontendd/` (React + Vite). Not a native mobile app.
- **WORKFLOW.md:** created (35 items).
- **Refinement:** **yes — 5 files repaired** (see §4).
- **Findings:** the backend was left in a **broken merge-conflict state** that made several modules fail to
  parse. Additionally: `await connectDB()` is commented out in `server.js:45`; `initSocket` is imported but
  never called (realtime layer dead); two endpoints are **not implemented** — `GET /:id/refund-status` and
  `GET /:id/refund-policy` (handlers `checkRefundStatus`/`checkRefundPolicy` never existed) — these are now
  **disabled with explanatory comments** rather than invented; duplicate route mounts; an `attendee` vs
  `customer` role mismatch; Playwright `testDir: ./e2e` excludes the 4 specs living in `tests/`.
- **Blockers:** `npm install` required in both `backend/` and `Frontendd/`; MongoDB + (optionally) Cloudinary/SMTP creds needed for full function; no `node_modules` present so the server was not booted.

### 3.6 `fitness-challenge-with-friends`
- **Type:** **Real mobile** — Expo / React Native app ("Rally") + a zero-dependency Node API in `server/`. Also a SwiftUI variant in `native/`.
- **WORKFLOW.md:** created (40 items).
- **Findings:** no `.env*` file anywhere; wide-open CORS; single-JSON-file storage.
- **Blocker (verified):** `npm run api` needs **Node ≥ 23.6** for TypeScript stripping; installed Node is
  **22.15.0** → `ERR_UNKNOWN_FILE_EXTENSION`. Verified workaround: `--experimental-strip-types` serves
  `/api/health` → `{"ok":true,"latestBuild":0}`. `npm run contrast` verified exit 0.
- **Refinement:** none.

### 3.7 `flashcards-with-spaced-repetition`
- **Type:** **Not mobile** — Chrome Extension (**Manifest V2**) in `chrome-extension/` + PHP/MySQL backend in `server/`.
- **WORKFLOW.md:** created (31 items).
- **Findings:** `server/config.php` uses `mysqli_connect("IP","username","password","database")` placeholders
  → real DB credentials must be supplied. Needs a PHP web server (XAMPP/Apache) + MySQL; extension loaded via
  `chrome://extensions` → *Load unpacked*. Manifest V2 is deprecated in current Chrome.
- **Refinement:** none.

### 3.8 `language-learning-mini-app`
- **Type:** **Not an app** — a collection of plain **Dart console programs** (`Quiz App`, `school management project`, `StopWatch App`, `To Do App (Dart Only)`).
- **WORKFLOW.md:** created (50 items).
- **Findings:** no Flutter UI, no `pubspec.yaml`; each program runs with the Dart SDK directly (`dart run <file>`). README has emoji mojibake — cosmetic only.
- **Refinement:** none.

### 3.9 `offline-first-note-app-with-sync`
- **Type:** **Real mobile** — Flutter package `todo`, Android + web (desktop = the web build served by a local wrapper on fixed port 8730).
- **WORKFLOW.md:** created (43 items).
- **Findings:** uses **FVM** (`.fvmrc`) and several git-hosted deps (`crdt_sync`, `design_system`, `github_device_auth`, `sync_settings_ui` from `github.com/kuhyx/utils`); README/AGENTS claims a 494-test suite at 100% coverage; has `dart run tool/sync_smoke.dart` (hits real GitHub, needs a token).
- **Blocker (verified):** `pubspec.yaml` requires Dart SDK `^3.12.2`; installed Flutter is 3.35.2 / Dart 3.9.0, and **FVM is not installed** → `flutter pub get` fails, so `flutter test` cannot run here. (No test results claimed.)
- **Refinement:** none.

### 3.10 `plant-disease-identifier`
- **Type:** **Not mobile** — Python **desktop GUI** (OpenCV + PyQt4/Tkinter).
- **WORKFLOW.md:** created (14 items).
- **Findings:** `requirements.txt` pins ancient packages (`numpy==1.15.4`, `pandas==0.23.4`, `matplotlib==3.0.2`, `opencv-python==3.4.5.20`, `scikit-learn==0.20.2`, plus the dummy `sklearn==0.0`) that will **not** install on Python 3.12; **PyQt4 is missing from `requirements.txt`**; no trained model file exists — `classifier.py` refits `GaussianNB` at runtime from `Datasetinfectedhealthy.csv` (114 rows). Metadata claims Flutter/TFLite/FastAPI — wrong.
- **Refinement:** none.

### 3.11 `student-buy-sell-marketplace-app`
- **Type:** **Real native iOS** SwiftUI app ("Panthers Marketplace") + Supabase.
- **WORKFLOW.md:** created (17 items).
- **Findings:** `supabase/functions/` and `supabase/migrations/` are **absent** (the `enforce-fiu-domain` entrypoint referenced by `config.toml` does not exist; no schema). Metadata claims Flutter/Firebase — wrong.
- **⚠ Security (verified):** `Panthers Marketplace/App.env` contains `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_PROJECT_REF` and **is git-tracked** despite being listed in `.gitignore`. **Values were not
  printed.** Recommended remediation (NOT performed by this task): rotate the anon key and
  `git rm --cached "Panthers Marketplace/App.env"`.
- **Blocker:** macOS + Xcode 16 + iOS 18.2 SDK required → impossible on Windows.
- **Refinement:** none.

### 3.12 `voice-memo-app-with-on-device-transcription`
- **Type:** **Not mobile** — **macOS** SwiftUI app ("Image Voice Memos") generated via XcodeGen.
- **WORKFLOW.md:** created (21 items).
- **Findings:** `project.yml` targets macOS 15.0 (arm64), Xcode 16; the `.xcodeproj` is gitignored, so
  `xcodegen generate` is mandatory first. `create-dmg.sh` uses macOS-native `hdiutil` (not the Homebrew
  `create-dmg` tool); brew deps are `xcodegen` and `gh`. **No test target exists.** Metadata claims
  Kotlin/Whisper.cpp/ML Kit — wrong.
- **Blocker:** macOS-only → cannot build on Windows.
- **Refinement:** none.

---

## 4. Repairs applied (only `event-ticketing-and-check-in-app`)

These were the **only** genuine, unambiguous code defects in the entire domain. Every edit is backed by a
`<file>.bak` copy in place, and each file was re-verified with `node --check` (ESM) afterwards.

| # | File | Defect found | Fix applied | Verified |
|---|---|---|---|---|
| 1 | `backend/src/server.js` | Duplicate imports: `helmet`, `cors`, `app` (×2), `initSocket` (×2) → `SyntaxError: Identifier 'helmet' has already been declared`, whole module unparsable | Removed the duplicate import lines (kept the single working set) | `node --check` → exit 0 |
| 2 | `backend/src/services/socket.js` | `socket.on('event:leave', …)` missing its closing `});` → `SyntaxError: missing ) after argument list` | Added the missing `});` | `node --check` → exit 0 |
| 3 | `backend/src/controllers/registrationController.js` | Interleaved duplicate `registerForEvent` copies, **duplicate `participantsForEvent` export**, orphaned `checkRegistrationStatus` body → `SyntaxError: Unexpected token 'catch'` / duplicate declarations | Reconstructed `registerForEvent` from the two copies (only clearly-recoverable intent kept), wrote a clean `myRegistrations`, reconstructed `checkRegistrationStatus` from the orphaned fragment, removed the duplicate export and orphaned block | `node --check` → exit 0; exports now unique (8 handlers) |
| 4 | `backend/src/routes/registrationRoutes.js` | Used undefined `registrationLimiter` (imported name is `registrationRateLimiter`); imported/used non-existent `checkRefundStatus`/`checkRefundPolicy`; duplicate `DELETE /:id/cancel` route | Renamed to `registrationRateLimiter`; **commented out** the two refund routes with an explanatory note (rather than inventing handlers) and removed the duplicate route | `node --check` → exit 0 |
| 5 | `backend/src/routes/notificationRoutes.js` | Imported `protect` from `middleware/auth.js`, which only exports `authenticate` → runtime crash on load | Changed import + usage to `authenticate` | static import/export cross-check → 0 problems |

**After repair, a full sweep of every `backend/src/**/*.js` file passed `node --check`, and the custom
import/export cross-check reported 0 missing imports or exports.** The server was **not** booted, because no
`node_modules` are installed and installing the full dependency tree was out of scope.

**Explicitly NOT done (documented, not invented):** `checkRefundStatus` and `checkRefundPolicy` were never
written — those two endpoints are disabled with comments rather than fabricated. `initSocket` remains
imported-but-uncalled in `server.js` (pre-existing; left as-is and documented).

Restoring the originals is trivial: each modified file has a sibling `*.bak`.

---

## 5. Environment blockers (recorded honestly)

| Blocker | Affected projects | Detail |
|---|---|---|
| Flutter/Dart SDK too old | `campus-carpool-app` (needs Dart ^3.10.1), `offline-first-note-app-with-sync` (needs Dart ^3.12.2) | Installed Flutter 3.35.2 = Dart 3.9.0. `flutter pub get` fails. |
| Pre-null-safety deps | `campus-navigation-app` | `cupertino_icons ^0.1.3` / `sdk <3.0.0` forbidden on modern SDK. |
| FVM not installed | `offline-first-note-app-with-sync` | `.fvmrc` present but no FVM binary to select the pinned SDK. |
| macOS + Xcode required | `student-buy-sell-marketplace-app`, `voice-memo-app-with-on-device-transcription`, and iOS targets of all RN/Flutter apps | Not available on Windows. |
| Node version too old | `fitness-challenge-with-friends` | API needs Node ≥ 23.6; installed 22.15.0 (verified workaround exists). |
| No package managers/deps installed | every Node/Expo project | no `node_modules`; requires `npm`/`pnpm install` (not run). |
| Docker not installed | `bus-schedule-and-live-tracking`, `student-buy-sell-marketplace-app` | Docker-based services (compose / `supabase start`) unavailable. |
| Python 3.12 vs 2018-era pins | `plant-disease-identifier` | `requirements.txt` cannot install on 3.12; no 3.7 interpreter / Docker available. |
| Android SDK not on PATH / licences unaccepted | all Android-capable projects | `adb`/`gradle` absent from PATH; emulator AVDs exist but were not used. |

---

## 6. Metadata vs. reality (corrections recorded)

`project-metadata.json` in these repos is aspirational and **wrong** for several projects. The real stack,
taken from code, is:

| Project | `project-metadata.json` claims | Actual stack (from code) |
|---|---|---|
| `campus-carpool-app` | Flutter + Google Maps + Firebase | Flutter + `flutter_map`/OSM; no Firebase |
| `campus-navigation-app` | (maps) | Flutter 2.x + `google_maps_flutter` |
| `event-ticketing-and-check-in-app` | mobile app | Web full-stack (Express + React) |
| `fitness-challenge-with-friends` | Flutter + Firebase | Expo/RN + Node API |
| `flashcards-with-spaced-repetition` | mobile | Chrome Extension MV2 + PHP/MySQL |
| `language-learning-mini-app` | mobile | Plain Dart console scripts |
| `offline-first-note-app-with-sync` | (notes) | Flutter + CRDT + GitHub sync (Android/web) |
| `plant-disease-identifier` | Flutter + TFLite + FastAPI | Python desktop GUI (OpenCV + PyQt4) |
| `student-buy-sell-marketplace-app` | Flutter + Firebase | Native iOS SwiftUI + Supabase |
| `voice-memo-app-with-on-device-transcription` | Kotlin + Whisper.cpp / ML Kit | macOS SwiftUI app (XcodeGen) |

---

## 7. Files created / modified

**Created (12):** `WORKFLOW.md` in each of the 12 project folders.

**Created (1):** this report — `Domain/Mobile App Development/mobile-app-refinement-report.md`.

**Modified (5, all in `event-ticketing-and-check-in-app/backend`):**
`src/server.js`, `src/services/socket.js`, `src/controllers/registrationController.js`,
`src/routes/registrationRoutes.js`, `src/routes/notificationRoutes.js`.

**Backups (5):** matching `*.bak` next to each modified file.

**No** commits, **no** pushes, **no** deploys. No other project was modified.

---

## 8. Unfinished items / recommended next steps

| Item | Project | Note |
|---|---|---|
| Install `node_modules` and boot the backend | `event-ticketing-and-check-in-app` | Repairs are syntactically verified but not runtime-booted. |
| Implement `checkRefundStatus` / `checkRefundPolicy` | `event-ticketing-and-check-in-app` | Intentionally left unimplemented (routes disabled). |
| Call `initSocket` if realtime is wanted | `event-ticketing-and-check-in-app` | Imported but never invoked. |
| Rotate + untrack the committed Supabase key | `student-buy-sell-marketplace-app` | `git rm --cached` + key rotation (manual). |
| Supply a Flutter/Dart SDK matching each pubspec | `campus-carpool-app`, `offline-first-note-app-with-sync`, `campus-navigation-app` | Then run `flutter pub get` / `flutter test`. |
| Install pnpm / watchman / deps | `calorie-tracker-with-barcode-scan` | Then run `jest` / Playwright. |
| Provide PHP + MySQL | `flashcards-with-spaced-repetition` | Fill real DB credentials (not committed). |
| Provide Node ≥ 23.6 | `fitness-challenge-with-friends` | Or keep using the `--experimental-strip-types` workaround. |
| Recreate a Python 3.7-era env | `plant-disease-identifier` | Pinned deps + missing PyQt4. |
| Provide macOS + Xcode | `student-buy-sell-marketplace-app`, `voice-memo-app-with-on-device-transcription` | Required to build at all. |

---

*End of report.*

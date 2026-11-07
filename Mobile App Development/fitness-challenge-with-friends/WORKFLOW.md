# Rally (fitness-challenge-with-friends) — Setup & Test Workflow

This document covers how to install, configure, run and test **Rally** — a friends fitness-challenge
app where a friend invites you to a challenge by text, you see the challenge and its consequence
before you make an account, you log one thing a day, and the app keeps score.

It is a **three-part** project:

| Part | Folder | What it is | Stack |
|---|---|---|---|
| Expo app (the main deliverable) | `app/`, `src/`, `shared/` | iOS / Android / web client, file-based routes | Expo SDK 57, React Native 0.86, React 19.2, Expo Router 57, TypeScript 6 |
| Zero-dependency API | `server/` | REST API + invite web pages, JSON-file storage | Node.js (runs the TypeScript directly), `node:http` only — **no npm dependencies** |
| Alternative native app | `native/` | A separate **SwiftUI** iOS app talking to the same server | SwiftUI, RealityKit, Metal, Apple Foundation Models |

**Honest scope note up front:** `project-metadata.json` claims the stack is *"Flutter; Firebase
Realtime"* and the goal mentions push nudges. **That metadata is wrong.** There is no Flutter and no
Firebase anywhere in this repository. The real stack is Expo/React Native plus a self-hosted Node
API that stores everything in a single JSON file. The metadata's own `entry` field —
`app.config.ts` — is correct.

**Honest scope note #2:** this checkout is **freshly downloaded and not installed**. `node_modules/`
is absent, no `.env` file exists, `server/data/` does not exist, and `.expo/` is absent. Nothing in
this document has been run end-to-end *as shipped* — the one exception is `npm run contrast` and the
API's `/api/health`, both of which were verified here and are labelled as such.

**Honest scope note #3:** the project targets **iOS 26** features heavily (Liquid Glass, Apple
Intelligence, `DynamicColorIOS`). On Windows you can run the API and the **web** build; the iOS
simulator, the native SwiftUI app and Apple Intelligence all need a Mac.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 works for the API + web build. **macOS required** for the iOS simulator and the SwiftUI app | — |
| **Node.js** | **23.6 or newer** — `server/index.ts:1` says *"Node 23.6+ runs .ts directly"*, and `Dockerfile:2` uses `node:24-slim`. **Node 22 is too old for the shipped npm scripts** (see 2.2). Installed here: **v22.15.0** | `node --version` |
| npm | Ships with Node. Installed here: **11.6.3** | `npm --version` |
| **npm packages** | The Expo app needs `npm install` (≈20 Expo packages). The **server needs none** — it imports only `node:*` built-ins | `Test-Path node_modules` |
| Expo Go / Expo CLI | Provided by `expo` in `devDependencies`? No — `expo` is a **runtime dependency** (`package.json:10`), so the CLI ships with it | `npx expo --version` |
| Expo Go app | Needed to run on a physical phone **without** a native build. Not needed for the web target | — |
| Xcode 26 + iOS 26 SDK | **macOS only.** Required for the simulator *and* for `native/Rally.xcodeproj` (`native/README.md`) | `xcodebuild -version` |
| Metal Toolchain | Required to build the SwiftUI app's shaders: `xcodebuild -downloadComponent MetalToolchain` | — |
| Apple Developer team | **Optional.** `APPLE_TEAM_ID` enables the Apple App Site Association file and iOS Associated Domains | — |
| Docker | **Optional.** Only to run the API as a container (port 8080) | `docker --version` |
| Fly.io CLI | **Optional.** Only for deploying to Fly.io | `fly --version` |
| Internet | Required for `npm install` and for Expo's Metro bundler / EAS build servers | — |

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 Install the app dependencies

`node_modules/` is **absent** (verified). `package-lock.json` **is** present, so `npm ci` is
available and reproducible:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm install
```

or

```powershell
npm ci
```

Key dependency versions (`package.json:5-41`):

| Package | Version | Package | Version |
|---|---|---|---|
| `expo` | `~57.0.22` | `expo-router` | `~57.0.21` |
| `react` | `19.2.3` | `react-native` | `0.86.3` |
| `react-dom` | `19.2.3` | `react-native-web` | `^0.21.2` |
| `expo-glass-effect` | `~57.0.3` | `expo-local-authentication` | `~57.0.3` |
| `expo-notifications` | `~57.0.18` | `expo-secure-store` | `~57.0.4` |
| `expo-contacts` | `~57.0.5` | `expo-sms` | `~57.0.2` |
| `expo-symbols` | `~57.0.3` | `expo-haptics` | `~57.0.3` |
| `expo-asset` | `~57.0.17` | `expo-constants` | `~57.0.18` |
| `expo-font` | `~57.0.4` | `expo-blur` | `~57.0.3` |
| `expo-linear-gradient` | `~57.0.2` | `expo-linking` | `~57.0.10` |
| `expo-splash-screen` | `~57.0.9` | `expo-status-bar` | `~57.0.1` |
| `expo-system-ui` | `~57.0.4` | `@react-native-async-storage/async-storage` | `2.2.0` |
| `@expo-google-fonts/lexend` | `^0.4.1` | `@expo/metro-runtime` | `~57.0.15` |
| `react-native-safe-area-context` | `~5.7.0` | `react-native-screens` | `~4.26.0` |
| `react-native-svg` | `15.15.4` | `typescript` (dev) | `~6.0.3` |
| `@types/node` (dev) | `^24.13.4` | `@types/react` (dev) | `~19.2.2` |

> The **server** needs no install at all — `server/index.ts` imports only `node:fs`, `node:http` and
> `node:crypto` (via `server/store.ts`). The API's "dependencies" are zero by design.

#### 2.2 The Node version problem — read this before `npm run api`

The shipped scripts are:

```json
"api": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON server/index.ts",
"seed": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON server/seed.ts"
```

They rely on Node's **native TypeScript execution**, which landed in Node **23.6**. On the Node
**v22.15.0** installed on this machine the script fails immediately — **verified here**:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for
  ...\fitness-challenge-with-friends\server\index.ts
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:219:9)
```

**Fix — install Node 23.6+ (or 24).** This is the cleanest option and matches the `Dockerfile`.

**Workaround if you must stay on Node 22** — Node 22.15 does support `--experimental-strip-types`.
**Verified working on this machine**:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON server/index.ts
```

With that flag the API starts and serves requests — `GET http://localhost:8787/api/health` returned
`{"ok":true,"latestBuild":0}` (verified). The same flag works for the seeder:

```powershell
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON server/seed.ts
```

Note the caveat: `--experimental-strip-types` only *erases* types; it does not transform
TypeScript-only syntax such as `enum` or `namespace`, or `import ... = require(...)`. The server
code does not use those, so it runs — but Node 23.6+ is the supported configuration.

#### 2.3 Environment variables

**There is no `.env` file and no `.env.example` in this repository** (verified — `Get-ChildItem
-Force -Filter ".env*"` returns nothing). Expo apps read `.env` files automatically; a plain Node
script does not, so for the server you either export the variables in the shell or put them in the
environment before launching.

**Client-side variables** (read in `src/api.ts`; `EXPO_PUBLIC_*` are inlined into the bundle by
Expo, so they are baked in at build time):

| Variable | Used by | Default / behaviour |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `src/api.ts:14-20` — `apiBase()` | If unset, the app uses `http://<host>:8787`, where `<host>` is the Metro host on a device or `localhost` on web. A trailing slash is stripped. |
| `EXPO_PUBLIC_INVITE_URL` | `src/api.ts:22-27` — `inviteLink()` | If unset, web uses `window.location.origin` and native uses `Linking.createURL('/invite/<token>')` (a `fitchallenge://` URL — **not tappable in Messages**, per `README.md`). |

**Build-time variables** (read in `app.config.ts`, consumed by Expo at prebuild/EAS-build time):

| Variable | Used by | Effect |
|---|---|---|
| `INVITE_DOMAIN` | `app.config.ts:9,16` | Sets iOS `associatedDomains` to `applinks:<domain>`. Without it, universal links do not work. |
| `APPLE_TEAM_ID` | `app.config.ts:19` | The signing team id written into the iOS build. Not committed on purpose. |

**Server-side variables** (read at runtime by `server/index.ts` and `server/store.ts`):

| Variable | Default | Read at | Effect |
|---|---|---|---|
| `PORT` | `8787` | `server/index.ts:127` | Listen port. The server binds `0.0.0.0`. |
| `DATA_FILE` | `<repo>/server/data/db.json` | `server/store.ts:165` | The single JSON file that holds all data. |
| `LATEST_BUILD` | `0` | `server/index.ts:28` | Newest build number; `/api/health` reports it so old apps can offer an update. |
| `PUBLIC_URL` | derived from the request host | `server/index.ts:133-134` | Base URL used for invite links. Falls back to `x-forwarded-proto` + `Host`. |
| `APP_SCHEME` | `fitchallenge` | `server/index.ts:153` | Custom scheme used in the invite page's install links. |
| `INSTALL_URL` | *(none)* | `server/index.ts:154` | Where the invite page sends someone who has not installed the app (TestFlight/App Store link). |
| `CONTACT_EMAIL` | *(none)* | `server/index.ts:164` | Shown on the `/privacy` page. |
| `APPLE_TEAM_ID` | *(none)* | `server/index.ts:174` | Serves `/.well-known/apple-app-site-association`. Without it the route answers **404** with a clear message. |
| `BUNDLE_ID` | `com.jean.fitnesschallenge` | `server/index.ts:174` | Bundle id written into the association file. |

Creating the file for the Expo app (optional — only needed for non-default hosts):

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
@"
EXPO_PUBLIC_API_URL=http://192.168.1.20:8787
EXPO_PUBLIC_INVITE_URL=https://rally.example.com
INVITE_DOMAIN=rally.example.com
"@ | Set-Content -LiteralPath ".env.local" -Encoding utf8
```

`.env*.local` is git-ignored (`.gitignore`), so this file is safe to create locally. **Do not commit
it.** Restart Metro after changing any `EXPO_PUBLIC_*` value — the values are baked into the
bundle at bundle time.

#### 2.4 Where the data lives

| Path | Purpose | Git-ignored? |
|---|---|---|
| `server/data/db.json` | **All** server state: users, PIN hashes, session tokens, crew, challenges, check-ins, workouts, notifications | **Yes** — `.gitignore` lists `/server/data/` with the comment *"session tokens, PIN hashes and real user records. Never commit."* |
| `server/data/db.json.tmp` | Write temp file; `store.ts:239-242` writes to `.tmp` then renames it over `db.json` (atomic replace) | Yes (same rule) |

The directory is created on demand (`store.ts:238`, `mkdirSync(..., { recursive: true })`). It does
**not** exist in a fresh checkout — verified.

To start over: stop the API, delete `server/data/`, restart.

#### 2.5 Native folders are git-ignored

`.gitignore` lists `/ios` and `/android`, so there is **no** `ios/` or `android/` folder in this
checkout. Expo generates them on demand with `npx expo prebuild`, and `npx expo run:ios` /
`run:android` do it for you.

---

### 3. Launch the Complete Project

#### 3.1 The API — the process you start first

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm run api
```

**Requires Node 23.6+.** On Node 22 use the workaround in 2.2. Expected output:

```
API on http://localhost:8787  data: ...\fitness-challenge-with-friends\server\data\db.json
```

That line is `server/index.ts:212`. Stop with `Ctrl+C`.

> The README says "Two processes. Start the API first." — that order matters, because the app's
> first screen immediately calls `GET /api/me` and shows an error if the API is not up.

#### 3.2 The app — Expo dev server

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm start
```

which is `expo start` (`package.json:43`). Expo prints a QR code plus a menu:

| Key | Action |
|---|---|
| `w` | Open the **web** build (works on Windows) |
| `i` | Open the **iOS simulator** (macOS only) |
| `a` | Open an **Android** emulator / connected device (needs Android SDK + a device) |
| `r` | Reload the app |
| `j` | Open the debugger |

Other targets:

```powershell
npm run web      # expo start --web
npm run ios      # expo run:ios     (macOS + Xcode)
npm run android  # expo run:android (needs Android SDK)
```

`npm run ios` / `npm run android` are **development builds**: they generate the native project,
install CocoaPods pods and compile the app. That is where `expo-glass-effect` and the local
`modules/rally-intelligence` module actually get linked.

#### 3.3 Both processes at once

Run the API in one PowerShell window and Expo in another:

```powershell
# Window 1
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm run api

# Window 2
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm start
```

#### 3.4 Talking to the API from a phone

The app finds the API on **port 8787** of whatever host serves the app (`src/api.ts:14-20`):

- **iOS simulator / web on the same machine** → `http://localhost:8787`. Works with no configuration.
- **A physical phone on the same Wi-Fi** → the host is taken from `Constants.expoConfig.hostUri`
  (the Metro host), so it also works with no configuration — but the phone must be able to reach
  that address, and `app.json` already asks for the `NSLocalNetworkUsageDescription` permission.
- **Anywhere else** → set `EXPO_PUBLIC_API_URL` to the API's public HTTPS address *before* starting
  Metro, then rebuild the bundle.

#### 3.5 Ports

| Component | Port | Address | Source |
|---|---|---|---|
| Rally API (local) | **8787** | `http://localhost:8787` | `server/index.ts:127` (`PORT ?? 8787`) |
| Rally API (Docker / Fly) | **8080** | `http://localhost:8080` | `Dockerfile` `ENV PORT=8080`; `fly.toml` `internal_port = 8080` |
| Expo / Metro dev server | **8081** | `http://localhost:8081` | Expo default |
| Expo web dev server | **8081** | `http://localhost:8081` | Expo default (Metro serves the web bundle) |

#### 3.6 Deploying the API with Docker

The `Dockerfile` has **no build step and no dependencies** — Node runs the TypeScript directly:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
docker build -t rally-api .
docker run --rm -p 8080:8080 -v rally-data:/data rally-api
```

`Dockerfile:7-8` sets `ENV PORT=8080 DATA_FILE=/data/db.json NODE_ENV=production`, and the
`rally_data` volume keeps the JSON file across restarts.

#### 3.7 Deploying the API to Fly.io

`fly.toml` is fully configured:

| Setting | Value |
|---|---|
| App name | `rally-friends` |
| Region | `lax` |
| `APPLE_TEAM_ID` | `B7H47WD4BU` |
| `BUNDLE_ID` | `com.jean.fitnesschallenge` |
| `LATEST_BUILD` | `10` |
| Volume | `rally_data` mounted at `/data` |
| Internal port | `8080`, `force_https = true` |
| Health check | `GET /api/health` every `30s`, timeout `5s` |
| Machine | `shared-cpu-1x`, `256mb` |

```powershell
fly launch --no-deploy     # only if you are creating the app for the first time
fly deploy --ha=false
```

`--ha=false` is required and is documented in the first line of `fly.toml`: the data is a **single
JSON file on a volume**, so a second machine would get its own separate copy.

---

### 4. Test the Project

There is **no test framework** in this project — no Jest, no Vitest, no Detox, no Playwright, and
no `test` script in `package.json`. What exists is one real, runnable check script plus manual
verification.

#### 4.1 The contrast check — `npm run contrast`

This is the project's own automated test. It reads the **real** values out of `src/theme.ts` and
`src/backdrop.tsx` (so it cannot drift from what ships) and checks every colour pair in all four
contexts: light, dark, Increase Contrast light and Increase Contrast dark.

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm run contrast
```

**Verified on this machine — exit code 0**, with the tail of the output:

```
  ok   small text on page                13.83:1  needs 4.5
  ok   small text on card                11.06:1  needs 4.5
  ok   small text on modal               12.10:1  needs 4.5
  ok   small text on tinted card          8.91:1  needs 4.5
  ok   white label on signal fill         6.67:1  needs 4.5
  ok   accent icon on page                8.27:1  needs 3
  ok   accent icon on card                6.61:1  needs 3
  ok   progress fill on track             4.64:1  needs 3
  ok   time bar on track                 11.77:1  needs 3
  ok   signal button vs page              3.15:1  needs 3

All required contrast ratios are met.
```

Thresholds come from Apple's floor: **4.5:1** for text (7:1 preferred for small text) and **3:1**
for icons and graphics. `scripts/contrast.mjs` exits non-zero if any pair fails.

#### 4.2 TypeScript check (not wired to a script)

`typescript` is a dev dependency but there is **no `typecheck`/`lint` script**. Run it manually:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npx tsc --noEmit
```

`tsconfig.json` is `strict: true` with `allowImportingTsExtensions: true` and **excludes `server`**
(server code is checked separately by `server/tsconfig.json`, which also has `strict: true` and
`noEmit: true`):

```powershell
npx tsc --noEmit -p server/tsconfig.json
```

> **Unverified.** `node_modules/` is absent, so neither command has been run in this checkout.

#### 4.3 API smoke test (Windows PowerShell, `curl.exe`)

Start the API first, then:

```powershell
# Health — the same endpoint Fly.io checks every 30 seconds
curl.exe -s http://localhost:8787/api/health
```

Verified output on this machine:

```json
{"ok":true,"latestBuild":0}
```

```powershell
# Sign up (open route)
curl.exe -s -X POST http://localhost:8787/api/signup `
  -H "Content-Type: application/json" `
  --data-binary "@$env:TEMP\signup.json"
```

> **curl quote-mangling on Windows.** `curl.exe` is a native binary and PowerShell's argument parser
> strips double quotes before the process sees them, so an inline `-d "{\"email\":\"x\"}"` arrives
> malformed and the API answers `400 Bad request`. Write the body to a file and use
> `--data-binary "@file.json"` — **the `@` and the quotes around the file name are both required**
> (curl's "read the body from this file" syntax). `Invoke-RestMethod` is the PowerShell-native
> alternative and needs no escaping at all:

```powershell
$signup = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8787/api/signup" `
  -ContentType "application/json" `
  -Body (@{ name = "Dana"; phone = "5550100001"; pin = "2580" } | ConvertTo-Json)
$token  = $signup.token
```

```powershell
# Authenticated read with the bearer token
Invoke-RestMethod -Uri "http://localhost:8787/api/me" `
  -Headers @{ Authorization = "Bearer $token" }
```

```powershell
# Check-in for today
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8787/api/checkin" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body (@{ activity = "gym"; minutes = 45 } | ConvertTo-Json)
```

**The full API surface** (`server/index.ts:28-83`):

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | no | `{ ok, latestBuild }` |
| `POST /api/signup` | no | Create an account; returns the session token |
| `POST /api/signin` | no | Sign in with phone + PIN |
| `GET /api/invites/:token` | no | Preview of an invite |
| `GET /api/me` | yes | Your profile |
| `PATCH /api/me` | yes | Update your profile |
| `POST /api/me/name/reset` | yes | Undo a "last name" consequence |
| `GET /api/home` | yes | The Home screen payload |
| `GET /api/me/summary` | yes | The Me tab payload |
| `GET /api/crew/:id` | yes | One crew member |
| `POST /api/crew/invite` | yes | Create an invite code |
| `GET /api/checkin` | yes | Today's check-in state |
| `POST /api/checkin` | yes | Log today's check-in |
| `POST /api/checkin/undo` | yes | Undo today's check-in |
| `GET /api/house` | yes | House challenges |
| `GET /api/workouts` | yes | Your workout log |
| `PATCH /api/workouts/:id` | yes | Edit a workout |
| `POST /api/steps` | yes | Sync steps |
| `POST /api/challenges` | yes | Create a challenge |
| `GET /api/challenges/:id` | yes | One challenge (full detail) |
| `POST /api/challenges/:id/join` | yes | Join |
| `POST /api/challenges/:id/consequence` | yes | Propose a consequence |
| `POST /api/challenges/:id/consequence/agree` | yes | Agree to a consequence |
| `POST /api/challenges/:id/rename` | yes | Apply the "last name" consequence |
| `POST /api/challenges/:id/removals` | yes | Request someone's removal |
| `POST /api/challenges/:id/talk` | yes | Post a message |
| `POST /api/challenges/:id/share` | yes | Toggle sharing |
| `POST /api/challenges/:id/add` | yes | Add someone to the challenge |
| `POST /api/challenges/:id/end` | yes | End it early |
| `POST /api/challenges/:id/delete` | yes | Delete it |
| `POST /api/challenges/:id/invite` | yes | Create an invite link for it |
| `POST /api/invites/:token/accept` | yes | Accept an invite |

**Non-JSON pages** served by the same process (`server/index.ts:142-180`):

| Path | Purpose |
|---|---|
| `/invite/:token` | The invite landing page, with Open Graph tags (`server/preview.ts`) so a link in Messages shows a card |
| `/privacy` | Privacy page; shows `CONTACT_EMAIL` |
| `/invite-image.png` | The OG image (the app icon) |
| `/.well-known/apple-app-site-association` | Apple universal-links file — **404 unless `APPLE_TEAM_ID` is set** |

**Two request behaviours worth knowing** (`server/index.ts:195-201`):

- The `X-Today` header overrides "today". The client sends `X-Today: localDate()`
  (`src/api.ts:151`), which is how the server and the phone agree on the calendar day.
- The bearer token is matched against `db.users[].token`; an unknown token means `401
  "Please sign in again."` and the client clears its session (`src/api.ts:178`).

#### 4.4 Seed the demo data

The seeder gives a **real signup** a crew and some history, so every screen has something to show.

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\fitness-challenge-with-friends"
npm run seed            # uses the most recent signup
npm run seed -- Dana    # targets a signup by name
```

> **Order matters.** `server/seed.ts:17-23` looks for an existing user and exits with
> `No signup found. Sign up in the app first, then run this again.` if there is none. **Sign up in
> the app (or via `POST /api/signup`) before seeding.**
>
> **Node version:** `npm run seed` uses the same native-TS execution as `npm run api` and needs
> Node 23.6+. Use the `--experimental-strip-types` workaround from 2.2 on Node 22.

What you get: a crew (Maria, Keisha, Tom), a live class challenge with an agreed consequence, a
steps challenge with a consequence waiting on a vote, a finished challenge you won ("Walk it off",
carrying the last-name consequence), and a few days of history so streaks and charts have data.

The demo user signs in with **phone `555 010 0001` and PIN `2580`** (development data only).

#### 4.5 Manual app walkthrough (web build, works on Windows)

1. `npm run api`, then `npm run web`, and open the URL Expo prints.
2. **Welcome** → "New here" / "Been here" / "Have an invite?".
3. Sign up → **Welcome / Create / Join / Me** tabs appear (`app/(tabs)/_layout.tsx:19-23` defines
   exactly three tabs: **Home**, **Check-in**, **Me**).
4. **Home** — your challenges. Empty at first; run the seeder (4.4) and reload to see the demo crew
   and challenges.
5. **Check-in** — log one thing for today (gym, walk, steps, miles).
6. **Me** — profile, crew, notifications, and the "new last name" notice if one is in effect.
7. **Create** (`app/create.tsx`) — a four-screen create flow.
8. **Join** (`app/join.tsx`) — paste an invite code (`K7M2-QX9R`, eight characters, no look-alikes,
   case-insensitive) or paste the whole invite text.
9. **Invite page** — open `/invite/<token>` in a browser to see the invite card.

**Screens in `app/`** (Expo Router, file-based):

| File | Route |
|---|---|
| `app/_layout.tsx` | Root stack + session restore |
| `app/(tabs)/index.tsx` | Home |
| `app/(tabs)/check-in.tsx` | Check-in |
| `app/(tabs)/me.tsx` | Me |
| `app/(tabs)/_layout.tsx` | The custom floating glass tab bar |
| `app/welcome.tsx` | Welcome / sign-in-or-up |
| `app/signup.tsx`, `app/signin.tsx` | Account creation and sign-in |
| `app/create.tsx` | Create-challenge flow |
| `app/join.tsx` | Join by code or link |
| `app/settings.tsx` | Settings |
| `app/challenge/[id].tsx` | One challenge |
| `app/log/[id].tsx` | Log a workout for a challenge |
| `app/invite/[token].tsx` | In-app invite handling |

#### 4.6 Simulator checks (macOS only)

`README.md` lists the simulator checks that were run by the author, with the exact `simctl`
commands:

```powershell
# macOS
xcrun simctl ui booted appearance dark
xcrun simctl ui booted appearance light
xcrun simctl ui booted content_size accessibility-large
xcrun simctl ui booted increase_contrast enabled
xcrun simctl spawn booted notifyutil -p com.apple.BiometricKit_Sim.pearl.match
xcrun simctl spawn booted notifyutil -p com.apple.BiometricKit_Sim.pearl.nomatch
```

Also covered: Light / Dark / Increase Contrast / Reduce Transparency (alone and combined in dark),
text at the largest accessibility size, Face ID (enrolled, rejected, matched, fallback), and a
signed-out invite deep link.

#### 4.7 The native SwiftUI app (macOS only)

```powershell
# macOS, from the repo root
open native/Rally.xcodeproj
```

or

```bash
xcodebuild -project native/Rally.xcodeproj -scheme Rally \
  -sdk iphonesimulator -derivedDataPath native/build
```

- Requires **iOS 26** and **Xcode 26 with the Metal Toolchain**
  (`xcodebuild -downloadComponent MetalToolchain`).
- The server address is the `RALLY_API_URL` build setting, default
  `http://Jeans-MacBook-Neo.local:8787` — **change it to your machine's address** and run
  `npm run api`.
- Same bundle id (`com.jean.fitnesschallenge`) and the same Keychain entry as the Expo build, so
  installing it over the Expo build keeps you signed in.
- Debug helpers: `xcrun simctl launch booted com.jean.fitnesschallenge -RallyDemo YES` and
  `-RallyWelcome YES`.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"` | Node < 23.6 cannot run the TypeScript server directly | Install Node 23.6+ (or 24), or add `--experimental-strip-types` (2.2) |
| `npm run api` fails but `npm run contrast` works | `contrast` is a `.mjs` script and needs no TypeScript support; `api`/`seed` are `.ts` | Same as above — the contrast script is unaffected by the Node version |
| `No signup found. Sign up in the app first, then run this again.` | The seeder needs an existing user | Sign up in the app (or `POST /api/signup`) first, then re-run |
| `<name> already has the demo crew.` | The seeder refuses to add the demo crew twice | Delete `server/data/db.json` and sign up again |
| App shows "Can't reach the server. Check your connection and try again." | The API is not running, or the app is pointing at the wrong host | Start `npm run api`; on a device confirm `EXPO_PUBLIC_API_URL`; the error text comes from `src/api.ts:169-176` |
| `The server is taking too long to answer` | The request exceeded the 10 s client timeout (`src/api.ts:124`) | Check the API process; the client aborts after `REQUEST_TIMEOUT_MS` |
| Phone cannot reach the API on 8787 | Different network, or the host address is not routable | Use `EXPO_PUBLIC_API_URL` with the LAN address, or expose it over HTTPS |
| Invite link opens the browser, not the app | `EXPO_PUBLIC_INVITE_URL` is unset, so native uses `fitchallenge://`, which is not tappable in Messages | Set `EXPO_PUBLIC_INVITE_URL` to an HTTPS address that serves the invite page |
| `/.well-known/apple-app-site-association` returns 404 with *"Set APPLE_TEAM_ID to publish the universal links association."* | `APPLE_TEAM_ID` is not set in the server's environment | Set `APPLE_TEAM_ID` (and `BUNDLE_ID`) and restart the API; `fly.toml` already sets both |
| Universal links do not open the app | `INVITE_DOMAIN` was not set at build time | Set `INVITE_DOMAIN` before `npx expo prebuild` / the EAS build, and serve the association file from that domain |
| `expo-glass-effect` has no effect | Glass requires a development build; it degrades in Expo Go | Use `npm run ios` / `npm run android` (dev build) |
| "Apple Intelligence is not available" | `modules/rally-intelligence` needs a native build, iOS 26 and an eligible device | The module reports `unsupported` on web, in Expo Go and on older devices (`modules/rally-intelligence/index.ts:13-19`); use an iPhone 15 Pro or newer with Apple Intelligence on, in a dev build |
| `npm run ios` fails on Windows | Xcode is macOS-only | Use the web target, or move to a Mac |
| `npx expo prebuild` says the native folders already exist | `/ios` and `/android` were generated earlier | Delete them (both are git-ignored) and re-run |
| `fly deploy` starts a second machine with an empty dataset | The data is one JSON file on a volume | Always deploy with `fly deploy --ha=false`, as `fly.toml` documents |
| `npm run contrast` fails after editing `src/theme.ts` | A palette token was renamed, or the ramp format changed | `scripts/contrast.mjs:16` requires `paper, paperRaised, card, ink, stone, track, signal, accent, signalTint`, each as `ramp('#hex', '#hex', '#hex', '#hex')` |
| `npx tsc --noEmit` reports errors in `server/` | `tsconfig.json` excludes `server` | Check the server separately with `npx tsc --noEmit -p server/tsconfig.json` |
| `Cannot find module 'expo/...'` | `npm install` was never run | `npm install` in the repo root |

**Known limitations to state honestly**

* **No automated test suite.** There is no Jest/Vitest/Detox/Playwright and no `test` script. The
  only automated check is `npm run contrast` (verified passing here). Everything else in this
  document is a manual procedure.
* **The Node version requirement is the single biggest setup obstacle.** `npm run api` and
  `npm run seed` need **Node 23.6+**; the machine here has **Node 22.15.0**, where they fail with
  `ERR_UNKNOWN_FILE_EXTENSION`. The `--experimental-strip-types` workaround was verified to work
  on 22.15.0, but it is not what the project ships or documents.
* **`node_modules/` is absent**, so `npm start`, `npx expo start` and `npx tsc --noEmit` have never
  been run in this checkout. Only `npm run contrast` (no dependencies needed) and the API's
  `/api/health` (Node built-ins only) were executed and verified.
* **There is no `.env` file or `.env.example`.** Every environment variable has to be discovered
  from the source (listed in 2.3). The Expo client reads `.env` automatically; **the plain Node
  server does not** — you must export the variables in the shell or start it with them set.
* **CORS is wide open.** `server/index.ts:100-104` sends `Access-Control-Allow-Origin: *` and allows
  the `Authorization` header, so **any origin can call the API**, including with a stolen bearer
  token. Fine for local development, not for production as it stands.
* **Authentication is a plain bearer token compared against a token stored in the JSON file**
  (`server/index.ts:200-201`). There is no expiry, no rotation and no rate limiting on any route.
  The PIN is stored as a `scrypt` hash with a per-user salt (`server/store.ts`), which is good, but
  the session token itself is a stored secret.
* **The whole database is one JSON file.** `server/store.ts:238-242` writes it atomically via a
  `.tmp` file and a rename, which is safe for a single process, but there is **no locking**: two
  server processes writing at once will lose one of the writes. This is why `fly.toml` insists on
  `--ha=false` and one machine.
* **One machine per deployment.** `fly.toml` mounts a single `rally_data` volume; scaling out would
  give each machine its own copy of the data.
* **`LATEST_BUILD` is stale relative to `app.json`.** `fly.toml` sets `LATEST_BUILD = "10"` while
  `app.json` has `buildNumber: "1"`. Raise `LATEST_BUILD` after each release, as the comment in
  `fly.toml` says.
* **`APPLE_TEAM_ID` is committed in `fly.toml`** (`B7H47WD4BU`). It is a team identifier, not a
  secret, but it is worth knowing that it is in the repository.
* **`modules/rally-intelligence` needs a native rebuild** (`pod install`, then build) and only works
  on an iPhone 15 Pro or newer with Apple Intelligence enabled and iOS 26. Everywhere else the
  screens behave as if the feature were absent (`availability()` returns `'unsupported'`).
* **The native SwiftUI app is macOS-only** and needs iOS 26, Xcode 26 and the Metal Toolchain. Its
  default `RALLY_API_URL` points at a specific author's Mac (`Jeans-MacBook-Neo.local`) and must be
  changed.
* **Expo Go cannot show the glass effects or Apple Intelligence**, so a walkthrough in Expo Go is
  not representative of the shipped app.
* **`project-metadata.json` is wrong** — it says Flutter + Firebase Realtime and mentions push
  nudges. There is no Flutter, no Firebase and no push notification implementation
  (`expo-notifications` is installed and the `Me` screen can toggle a `notifications` flag on the
  user record, but the server does not push anything).
* **No CI configuration** — there is no `.github/` workflow in this project, so nothing runs
  automatically.
* **The app only supports the "one log a day" model** for session challenges; the README is
  explicit that this is deliberate, and community, rewards, photo proof and chat are out of scope
  "on purpose".

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Environment**

- [ ] `node --version` prints **23.6 or newer** (or you have decided to use the
      `--experimental-strip-types` workaround from 2.2)
- [ ] `npm install` completed in the repo root and `node_modules/` now exists
- [ ] You know that the **server** needs no dependencies of its own

**API**

- [ ] `npm run api` prints `API on http://localhost:8787  data: ...\server\data\db.json`
- [ ] `curl.exe -s http://localhost:8787/api/health` returns `{"ok":true,"latestBuild":0}`
- [ ] `GET /api/health` still answers `200` after a restart (it is the Fly.io health check)
- [ ] `POST /api/signup` returns a token
- [ ] `GET /api/me` with `Authorization: Bearer <token>` returns your profile
- [ ] `POST /api/checkin` logs today and `GET /api/checkin` reflects it
- [ ] `GET /invite/<token>` renders an HTML invite page with Open Graph tags
- [ ] `GET /privacy` renders the privacy page
- [ ] You have noted that `/.well-known/apple-app-site-association` returns 404 unless
      `APPLE_TEAM_ID` is set
- [ ] `server/data/db.json` exists after the first write and is **not** in git
- [ ] You have deleted `server/data/` and confirmed the server starts clean

**Automated check**

- [ ] `npm run contrast` prints "All required contrast ratios are met." and exits 0
- [ ] `npx tsc --noEmit` completes without errors in the app
- [ ] `npx tsc --noEmit -p server/tsconfig.json` completes without errors in the server

**App**

- [ ] `npm start` shows the Expo menu and a QR code
- [ ] `npm run web` opens the app in a browser
- [ ] The app shows the Welcome screen and you can sign up
- [ ] The three tabs (Home, Check-in, Me) are present and switch correctly
- [ ] `npm run seed` succeeds **after** a signup, and Home then shows the demo crew and challenges
- [ ] `npm run seed -- Dana` targets the right user
- [ ] The demo user signs in with phone `555 010 0001` and PIN `2580`
- [ ] You can create a challenge, join one with a code, log a check-in and see the standings update
- [ ] The invite link opens the invite page and, once `EXPO_PUBLIC_INVITE_URL` is set, opens the app
- [ ] `npm run ios` / `npm run android` produces a dev build (macOS / Android SDK required)

**Deployment (optional)**

- [ ] `docker build -t rally-api .` succeeds and the container answers `/api/health` on 8080
- [ ] The container's `/data` volume survives a restart
- [ ] `fly deploy --ha=false` succeeds and Fly's health check on `/api/health` passes
- [ ] `LATEST_BUILD` in `fly.toml` has been raised to match the build you are shipping

**Native SwiftUI app (macOS only)**

- [ ] Xcode 26 with the Metal Toolchain is installed
- [ ] `xcodebuild -project native/Rally.xcodeproj -scheme Rally -sdk iphonesimulator` builds
- [ ] `RALLY_API_URL` points at your machine, and `npm run api` is running
- [ ] The SwiftUI app signs in against the same API and the same data
- [ ] You have confirmed that Apple Intelligence features are either working (iPhone 15 Pro+, iOS 26)
      or correctly reporting `unsupported`

**Cleanup**

- [ ] The API was stopped with `Ctrl+C` and the Expo dev server with `Ctrl+C`
- [ ] `Get-NetTCPConnection -State Listen -LocalPort 8787,8080,8081 -ErrorAction SilentlyContinue`
      shows nothing unexpected still bound
- [ ] `server/data/` still contains your local records and is git-ignored (it is not staged)
- [ ] No `.env.local` with real credentials has been committed

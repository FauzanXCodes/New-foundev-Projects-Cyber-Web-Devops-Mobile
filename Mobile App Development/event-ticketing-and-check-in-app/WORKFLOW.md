# eventone (event-ticketing-and-check-in-app) — Setup & Test Workflow

This document covers how to install, configure, launch and test **eventone**, the full-stack event
management platform in this folder. It is a **two-part** project:

| Part | Folder | Package name | Stack |
|---|---|---|---|
| REST API + realtime | `backend/` | `eventone-backend` | Node.js + Express 5 + Mongoose 8 (MongoDB) + Socket.IO 4, ESM (`"type": "module"`) |
| Web client | `Frontendd/` | `eventone-frontend` | React 19 + Vite 6 + Tailwind 3 + React Router 7 |

The repository root `package.json` is named **`eventone`** and holds only convenience scripts.

**Honest scope note up front:** this is a **web** application, not a native mobile app — there is no
React Native, Expo or Capacitor project here, despite the folder living under "Mobile App
Development". `project-metadata.json` claims the stack is *"React Native; Supabase"* and that the
entry point is `Frontendd/index.html`; **that metadata is wrong**. The real stack is React + Vite on
the frontend and Express + MongoDB on the backend. The code is the source of truth.

**Honest scope note #2:** the backend was repaired from genuine merge corruption (duplicate imports,
a missing brace, interleaved duplicate handlers, two wrong identifier names). Those repairs are
present in the working tree. **Two endpoints are still unimplemented and are deliberately disabled
in code**, and one import is still dead — all three are listed explicitly in section 5.

**Honest scope note #3:** nothing in this document was executed end-to-end. `node_modules/` is absent
in **all three** package roots, and **neither `mongod` nor Docker is installed on this machine**, so
`npm install`, `npm test` and any database-backed run are **unverified** here.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 (all commands below are PowerShell) | `Get-Host` |
| Node.js | **18+** (README badge and CI pin **18**; `.github/workflows/test.yml` uses **20**). Installed here: **v22.15.0** | `node --version` |
| npm | Ships with Node. Installed here: **11.6.3** | `npm --version` |
| **MongoDB** | **Required for real use.** No local server is running and `mongod` is **not on `PATH`** on this machine. CI uses the `mongo:6` service image. | `Get-Command mongod` |
| Git | Any recent version (the repo is already a checkout) | `git --version` |
| Internet | Required for `npm install` (npm registry), for `mongodb-memory-server` (downloads a MongoDB binary on first run) and for Cloudinary/SMTP | — |
| Cloudinary account | **Optional.** Only needed for the poster-upload path (`CLOUDINARY_*` in `backend/.env.example`) | — |
| SMTP account (Gmail) | **Optional.** Only needed for the confirmation emails (`SMTP_*`) | — |
| Docker | **Optional.** `Frontendd/docker-compose.yml` only containerises the frontend (nginx); there is **no** MongoDB or backend service in it | `docker --version` |
| Playwright browsers | **Optional.** Needed for `npx playwright test` (`npx playwright install`) | — |
| Node.js / MongoDB for the frontend | The frontend needs **Node** only | — |

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 Install dependencies — nothing is installed yet

`node_modules/` is **absent** in `backend/`, in `Frontendd/` and at the repo root (verified with
`Test-Path`). Two independent installs are required.

**Option 1 — the root convenience script** (`package.json:10`):

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app"
npm run install:all
```

which expands to `cd backend && npm install && cd ../Frontendd && npm install`.

**Option 2 — install each part separately** (clearer error reporting):

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\backend"
npm install

Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\Frontendd"
npm install
```

Both folders ship a `package-lock.json`, so `npm ci` also works and is what CI uses for the frontend.

**Backend dependencies** (`backend/package.json:25-53`) — the versions actually declared:

| Package | Declared | Package | Declared |
|---|---|---|---|
| `bcryptjs` | `^3.0.3` | `mongoose` | `^8.24.0` |
| `cloudinary` | `^2.10.0` | `morgan` | `^1.10.1` |
| `compression` | `^1.8.1` | `multer` | `^2.1.1` |
| `cookie-parser` | `^1.4.7` | `nodemailer` | `^8.0.7` |
| `cors` | `^2.8.5` | `qrcode` | `^1.5.4` |
| `csv-writer` | `^1.6.0` | `socket.io` | `^4.8.3` |
| `dotenv` | `^17.2.1` | `validator` | `^13.15.35` |
| `express` | `^5.1.0` | `cross-env` | `^10.1.0` (dev) |
| `express-rate-limit` | `^8.0.1` | `jest` | `^30.4.2` (dev) |
| `express-validator` | `^7.3.2` | `mongodb-memory-server` | `^10.4.3` (dev) |
| `helmet` | `^8.1.0` | `nodemon` | `^3.1.14` (dev) |
| `jsonwebtoken` | `^9.0.3` | `supertest` | `^7.2.2` (dev) |

**Frontend dependencies** (`Frontendd/package.json:12-57`) — key ones: `react ^19.2.3`,
`react-dom ^19.2.0`, `react-router-dom ^7.11.0`, `socket.io-client ^4.8.3`, `jspdf ^4.2.1`,
`html2canvas ^1.4.1`, `html5-qrcode ^2.3.8`, `framer-motion ^12.23.26`, `react-big-calendar ^1.19.4`,
`tailwindcss ^3.4.19`; dev: `vite ^6.0.0`, `@vitejs/plugin-react ^5.2.0`, `vite-plugin-pwa ^1.3.0`,
`eslint ^9.39.1`, `@playwright/test ^1.60.0`, `typescript` via `@types/*`.

#### 2.2 Create the backend `.env`

`backend/.env` **does not exist** in this checkout (verified). `backend/src/config/env.js:6-14`
**throws at startup** if `JWT_SECRET` is missing, in every environment — not just production:

```js
const requiredEnvVars = ['JWT_SECRET'];
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('MONGO_URI', 'CLIENT_URL');
}
```

Create it from the shipped template:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\backend"
Copy-Item .env.example .env
notepad .env
```

Every variable in `backend/.env.example` and what it controls:

| Variable | Example value | Read at | Effect |
|---|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/event_mgmt` | `config/env.js:19` | Mongoose connection string. Default matches the example. |
| `JWT_SECRET` | *(a long random string)* | `config/env.js:20` | HS256 signing key. **Required — the server will not boot without it.** |
| `JWT_EXPIRES_IN` | `7d` | `config/env.js:21` | Token lifetime. |
| `PORT` | `5050` | `config/env.js:18` | API listen port. Default `5050`. |
| `CLIENT_URL` | `http://localhost:5173` | `config/env.js:22` | CORS origin (`app.js:26`) and the socket.io origin. Default `http://localhost:5173`. |
| `SMTP_HOST` | `smtp.gmail.com` | `config/env.js:23` | Nodemailer host. |
| `SMTP_PORT` | `587` | `config/env.js:24` | Nodemailer port. |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | `config/env.js:25-26` | Mailbox credentials. Empty ⇒ mail sending is skipped. |
| `APP_NAME` | `eventone` | `config/env.js:35` | Branding in emails/UI. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | *(empty)* | `config/env.js:29-31` | Poster upload. Empty ⇒ the Cloudinary path is unavailable. |
| `EMAIL_FROM` | `eventone <no-reply@eventone.local>` | `config/env.js:33` | `From:` header. |
| `API_RATE_LIMIT_MAX` | `120` | **not read** | **Dead variable** — `app.js:34` hardcodes `rateLimit({ windowMs: 60*1000, max: 120 })`. Changing it has no effect. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | `middleware/rateLimiters.js:21` | Auth limiter window (15 min). |
| `AUTH_RATE_LIMIT_MAX` | `10` | `middleware/rateLimiters.js:27` | Auth limiter max. |
| `REGISTRATION_RATE_LIMIT_WINDOW_MS` | `60000` | `middleware/rateLimiters.js:43` | Registration limiter window (1 min). |
| `REGISTRATION_RATE_LIMIT_MAX` | `5` | `middleware/rateLimiters.js:50` | Registration limiter max. |

> **Security note.** `.env` is git-ignored (`.gitignore` lists `.env`, `backend/.env`,
> `Frontendd/.env`), so it is safe to create locally — but never commit it.

> **Two duplicate keys in `backend/src/config/env.js`**: `emailFrom` is defined at lines 27 **and** 33,
> and `appName` at lines 28 **and** 35. In JavaScript the **last** definition wins, so the effective
> values come from lines 33 and 35. Harmless today, but it is leftover merge damage — clean it up if
> you touch that file.

#### 2.3 The frontend `.env` is optional

`Frontendd/.env.example` exists and documents a single variable:

```dotenv
VITE_API_URL=
```

> **Read this before trusting `.env.example`.** The file's comment says *"Leave `VITE_API_URL` empty.
> The Vite dev server proxy handles /api requests automatically (see vite.config.js)"*. A proxy for
> `/api` and `/uploads` **is** configured (`Frontendd/vite.config.js:74-87`), **but no app code uses
> it**: every request in `Frontendd/src/` is built from `API_BASE_URL`
> (`Frontendd/src/config.js:2-6`), which defaults to `http://localhost:5050`. So with an empty
> `VITE_API_URL` the browser calls the API **directly on port 5050**, cross-origin from
> `http://localhost:5173`. That is exactly why the backend needs `CLIENT_URL=http://localhost:5173`
> (its CORS origin, `app.js:26`).

- **Empty (the default)** — the client uses `http://localhost:5050` directly.
  **Nothing to configure.**
- **Set** — `Frontendd/src/config.js:4-6` uses `import.meta.env.VITE_API_URL` (trailing slash
  stripped) instead, e.g. `https://api.example.com`.
- **Watch out:** `Frontendd/src/CoOrganizerPanel.jsx:3` reads a **differently named** variable —
  `import.meta.env.VITE_API_BASE_URL` — not `VITE_API_URL`. Setting only `VITE_API_URL` leaves that
  one panel pointing at its hardcoded `http://localhost:5050` fallback.

You do **not** need to create `Frontendd/.env` for local development. Do create it only if you want
to point the client at a remote API:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\Frontendd"
Copy-Item .env.example .env
```

#### 2.4 Provide a MongoDB server

MongoDB is required for every database-backed route (events, registrations, users, reviews, stats).
The default `MONGO_URI` expects a server on `127.0.0.1:27017` with database `event_mgmt`.

**Neither `mongod` nor Docker is installed on this machine** (verified: `Get-Command mongod` and
`Get-Command docker` both return nothing). Options:

1. Install MongoDB Community Server for Windows and start the `mongod` service.
2. Use MongoDB Atlas and put the Atlas connection string into `MONGO_URI`.
3. Install Docker Desktop and run `docker run -d --name eventone-mongo -p 27017:27017 mongo:6`
   (this is exactly what `.github/workflows/ci.yml:190-198` does with the `mongo:6` service image).

Do **not** rely on `Frontendd/docker-compose.yml` for the database — it contains a single `web`
service only (`build: .`, `ports: ["8080:80"]`), i.e. the nginx-served frontend.

#### 2.5 Seed the demo data (optional but recommended)

`backend/src/seed.js` **wipes** `User`, `Event`, `Registration` and `Review` collections before
inserting (`seed.js:153-158`). It refuses to run when `NODE_ENV=production` (`seed.js:143-148`).

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\backend"
npm run seed
```

This creates three users, five events (with prices and dates engineered for the refund rules) and
five registrations, then prints the seeded credentials:

| Role | Email | Password |
|---|---|---|
| customer | `customer@example.com` | `password` |
| organizer | `organizer@example.com` | `password` |
| admin | `admin@example.com` | `password` |

It also prints the created registration IDs and a refund test-case legend. **The seeder needs a
reachable MongoDB** — `seed.js:150` calls `connectDB()`, which on failure logs
`MongoDB connection error: …` and calls `process.exit(1)`.

#### 2.6 A pre-existing merge-repair, and the leftovers of it

The backend was genuinely corrupted by a bad merge and has been repaired. The repaired files are
the ones you edit:

| File | Corruption that was fixed |
|---|---|
| `backend/src/server.js` | Duplicate imports |
| `backend/src/services/socket.js` | Missing closing brace |
| `backend/src/controllers/registrationController.js` | Duplicate / interleaved handler bodies (see the explanatory comment at lines 15-18) |
| `backend/src/routes/registrationRoutes.js` | Typo `registrationLimiter` → `registrationRateLimiter` |
| `backend/src/routes/notificationRoutes.js` | `protect` → `authenticate` |

**However, the pre-repair copies are still committed as `.bak` files** and are still on disk:

```
backend/src/server.js.bak
backend/src/services/socket.js.bak
backend/src/controllers/registrationController.js.bak
backend/src/routes/registrationRoutes.js.bak
backend/src/routes/notificationRoutes.js.bak
```

They are **not** loaded by Node (the extension is `.bak`, not `.js`), but `registrationRoutes.js.bak`
still contains the unfixed `router.get("/:id/refund-status", authenticate, checkRefundStatus)` lines
and would throw a `ReferenceError` if it were ever renamed back to `.js`. **Do not restore them.**
You may delete them, but that is a change to the repo — leaving them alone is also fine.

---

### 3. Launch the Complete Project

#### 3.1 Backend — API on port 5050

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\backend"
npm run dev
```

which is `nodemon src/server.js` (`backend/package.json:9`). For a plain run without the watcher:

```powershell
npm start     # node src/server.js
```

Expected console output:

```
Server running on http://localhost:5050
```

That string comes from `backend/src/server.js:48`. Stop with `Ctrl+C`.

**Entry point chain:** `backend/src/server.js` → creates an `http.Server` around the Express `app`
(`backend/src/app.js`) → mounts the route modules → `start()` → `server.listen(env.port, …)`.

**Routes actually mounted** (`backend/src/app.js:46-53`):

| Prefix | Module | Notable endpoints |
|---|---|---|
| `/api/auth` | `routes/authRoutes.js` | `POST /signup`, `POST /login`, `GET /me`, `PUT /profile` |
| `/api/events` | `routes/eventRoutes.js` | `GET /`, `GET /tags/popular`, `GET /:id`, `POST /` (organizer/admin, poster upload) |
| `/api/registrations` | `routes/registrationRoutes.js` | `POST /:id/register`, `GET /me`, `GET /:id/status`, `GET /:id/participants`, `POST /:id/checkin`, `GET /:id/participants.csv`, `DELETE /:id/cancel` |
| `/api/reviews` | `routes/reviewRoutes.js` | — |
| `/api/admin` | `routes/adminRoutes.js` | — |
| `/api/stats` | `routes/statsRoutes.js` | — |
| `/api/users` | `routes/userRoutes.js` | — |
| `/api/notifications` | `routes/notificationRoutes.js` | `GET /`, `GET /unread-count`, `PATCH /read-all`, `PATCH /:id/read`, `DELETE /:id` |

#### 3.2 Frontend — Vite dev server on port 5173

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\Frontendd"
npm run dev
```

which is `vite` (`Frontendd/package.json:7`). No `server.port` is set in `vite.config.js`, so Vite
uses its default **5173** and prints the URL. Stop with `Ctrl+C`.

Client-side routes are declared in `Frontendd/src/App.jsx:118-201`: `/`, `/features`, `/pricing`,
`/contact`, `/support`, `/about-us`, `/login`, `/signup`, `/forgot-password`, `/thank-you`,
`/profile`, `/customer/dashboard`, `/organizer/dashboard`, `/organizer/scan/:eventId`,
`/organizer/create-event`, `/admin/dashboard`, `/admin/pending-events`, plus a `*` → `NotFound`.

Other frontend scripts:

```powershell
npm run build      # vite build  -> dist/
npm run preview    # vite preview -> serves the production build
npm run lint       # eslint .
```

#### 3.3 Both parts from the repo root

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app"
npm run dev:backend    # cd backend && npm run dev
npm run dev:frontend   # cd Frontendd && npm run dev
```

Each of these blocks, so run them in **two separate PowerShell windows**.

#### 3.4 Ports

| Component | Port | Address | Notes |
|---|---|---|---|
| Express API | **5050** | `http://localhost:5050` | `PORT=5050` (`backend/.env.example:4`) |
| Vite dev server | **5173** | `http://localhost:5173` | Vite default; also `CLIENT_URL` in `backend/.env.example:5` |
| MongoDB | **27017** | `mongodb://127.0.0.1:27017/event_mgmt` | `MONGO_URI` default (`backend/src/config/env.js:19`) |
| Socket.IO | **5050** (shares the API) | `ws://localhost:5050/socket.io` | Would be same-origin with the API — but see the caveat in 5.2 |
| Frontend container (nginx) | **8080** | `http://localhost:8080` | `Frontendd/docker-compose.yml:5` maps `8080:80` |
| SMTP (outbound) | 587 | `smtp.gmail.com` | `SMTP_PORT` |

---

### 4. Test the Project

#### 4.1 Backend unit/integration tests — Jest + Supertest + in-memory MongoDB

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\backend"
npm test
```

`backend/package.json:13` defines it as:

```
cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

- `--experimental-vm-modules` is required because the project is ESM (`"type": "module"`).
- Jest config lives in `backend/package.json:55-63`: `testEnvironment: "node"`,
  `setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.js"]`, and that same setup file is excluded
  from the test path via `testPathIgnorePatterns`.
- `src/__tests__/setup.js` spins up **`mongodb-memory-server`** (`MongoMemoryServer.create()`), points
  Mongoose at it, clears every collection after each test, and drops the database afterwards. **The
  first run downloads a MongoDB binary from the internet** — allow time and network access.
- Test files: `src/__tests__/auth.test.js`, `events.test.js`, `registrations.test.js`,
  `admin.bulk.test.js`.
- `setup.js:1` sets `process.env.JWT_SECRET = 'testsecret'`, so no `.env` is needed for the tests.

> **Unverified in this checkout.** `node_modules/` is absent, so `npm test` has never been executed
> here. Treat the above as the documented contract, not as a result.

#### 4.2 Frontend end-to-end tests — Playwright

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\event-ticketing-and-check-in-app\Frontendd"
npx playwright install --with-deps
npx playwright test --reporter=list
```

`Frontendd/playwright.config.js` sets `testDir: './e2e'`, `timeout: 30000`, and
`baseURL: process.env.CLIENT_URL || 'http://localhost:5173'`.

**Outside CI** it auto-starts both servers for you (`webServer` array, lines 16-31):

```javascript
{ command: 'cd ../backend && npm run dev', port: 5050, reuseExistingServer: false, timeout: 120000 },
{ command: 'npm run dev',                  port: 5173, reuseExistingServer: false, timeout: 120000 },
```

**In CI** (`CI=true`) `webServer` is `undefined` and the backend/frontend are started by
`.github/workflows/ci.yml` instead.

**In CI** the workflow also passes `CLIENT_URL` and `API_URL`:

```yaml
env:
  CLIENT_URL: "http://localhost:5173"
  API_URL: "http://localhost:5050"
  CI: "true"
```

> **Honest discrepancy:** the Playwright `testDir` is `./e2e`, so only `Frontendd/e2e/smoke.spec.js`
> (3 smoke tests: `/`, `/signup`, `/login` load) is executed. The **four** richer specs in
> `Frontendd/tests/` — `admin.spec.js`, `auth.spec.js`, `customer.spec.js`, `organizer.spec.js`
> (plus a `tests/utils/login.js` helper) — are **outside `testDir` and are not run** by
> `npx playwright test`. To run them you would have to point `--config` at a different `testDir` or
> move the files; that is a code change, not part of this workflow.

#### 4.3 Manual API checks (Windows PowerShell, `curl.exe`)

Start the backend first (`npm run dev` in `backend/`), then:

```powershell
# Health — the CI workflow uses exactly this endpoint to wait for readiness
curl.exe -s -o NUL -w "HTTP %{http_code}`n" http://localhost:5050/api/events
```

```powershell
# List events (public route, no token needed)
curl.exe -s http://localhost:5050/api/events
```

```powershell
# Login as the seeded customer and capture the JWT
curl.exe -s -X POST http://localhost:5050/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"customer@example.com\",\"password\":\"password\"}'
```

> **curl quote-mangling on Windows.** `curl.exe` is a native binary; PowerShell's argument parser
> strips double quotes before the process sees them, so `-d "{\"email\":\"x\"}"` arrives malformed
> and the server answers `400 Bad request`. The three robust options are:
>
> 1. Write the body to a file and use `--data-binary "@file.json"` — **note the leading `@` and the
>    double quotes around the file name**; that is curl's "read the body from this file" syntax, and
>    in PowerShell the argument must stay quoted exactly as `--data-binary "@body.json"`.
> 2. Use `Invoke-RestMethod` instead of curl (PowerShell handles the JSON natively).
> 3. Use single quotes around the whole `-d` payload **and** escape the inner quotes as `\"`.
>
> Example using a file (option 1):
>
> ```powershell
> $body = '{"email":"customer@example.com","password":"password"}'
> Set-Content -LiteralPath "$env:TEMP\login.json" -Value $body -Encoding utf8
> curl.exe -s -X POST http://localhost:5050/api/auth/login `
>   -H "Content-Type: application/json" `
>   --data-binary "@$env:TEMP\login.json"
> ```
>
> Example using `Invoke-RestMethod` (option 2):
>
> ```powershell
> $resp = Invoke-RestMethod -Method Post `
>   -Uri "http://localhost:5050/api/auth/login" `
>   -ContentType "application/json" `
>   -Body (@{ email = "customer@example.com"; password = "password" } | ConvertTo-Json)
> $token = $resp.token
> ```
>
> Then use the token on protected routes:
>
> ```powershell
> Invoke-RestMethod -Uri "http://localhost:5050/api/registrations/me" `
>   -Headers @{ Authorization = "Bearer $token" }
> ```

Other endpoints worth exercising once seeded:

| Request | Expected |
|---|---|
| `GET /api/events` | `200` with the seeded event list |
| `GET /api/events/tags/popular` | `200` with a tag frequency map |
| `GET /api/notifications/unread-count` (with token) | `200` with a count |
| `GET /api/registrations/me` (with token) | `200` with `{ registrations: [...] }` |
| `GET /api/registrations/:id/refund-status` | **`404`** — the route is intentionally not registered (see 5.1) |
| `GET /api/registrations/:id/refund-policy` | **`404`** — same |

#### 4.4 Manual browser checks (frontend on 5173)

1. `http://localhost:5173/` renders the EventOne landing page with the header and footer.
2. `http://localhost:5173/signup` → create an account. The `User` model allows the roles
   `customer`, `organizer`, `admin`, `attendee`, defaulting to `customer`
   (`backend/src/models/User.js:29-30`).
3. `http://localhost:5173/login` → sign in as `customer@example.com` / `password`.
4. The **Events** page loads from `/api/events`. Because `VITE_API_URL` is empty, the browser calls
   `http://localhost:5050/api/events` **directly** (cross-origin from `:5173`) — check the backend
   console for the `morgan` request log. If the browser console shows a CORS error, `CLIENT_URL` in
   `backend/.env` does not match `http://localhost:5173`.
5. Register for an event → a QR code is generated server-side
   (`backend/src/utils/qrcode.js` → `generateQRCodeDataUrl`), a `Registration` is created and the
   event's `registeredCount` is incremented atomically.
6. Download the PDF ticket → `jspdf` + `html2canvas` render it client-side.
7. As an **organizer**, open `/organizer/dashboard` → participant list, CSV export
   (`GET /api/registrations/:id/participants.csv`), and `/organizer/scan/:eventId` for QR scanning.
8. As an **admin**, open `/admin/dashboard` → approve/reject events and view platform stats.

> **Honest discrepancy:** `Frontendd/src/App.jsx:145` guards `/customer/dashboard` with
> `allowedRoles={['attendee']}`, but the backend seeds and defaults users with the role
> **`customer`**. A seeded `customer@example.com` will therefore be redirected away from
> `/customer/dashboard` by the client's own guard. This is a real inconsistency in the repo, not a
> step you did wrong.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error: Missing required environment variable: JWT_SECRET. Copy backend/.env.example to backend/.env and fill in the values.` | `backend/.env` is missing (it is not in the repo) | `Copy-Item .env.example .env` inside `backend/`, then set a real `JWT_SECRET` |
| `MongoDB connection error: …` then the process exits | No MongoDB reachable at `MONGO_URI` | Start MongoDB / Atlas / Docker `mongo:6`; check `MONGO_URI` (2.4) |
| API starts, but every DB route hangs and eventually errors with a Mongoose buffering timeout | **`backend/src/server.js:45` has `//await connectDB();` commented out** — the server never opens a Mongoose connection at startup | Uncomment `await connectDB();` in `start()` (this is a one-line code change) or ensure the connection is established before serving |
| `Cannot find module '…'` on `npm run dev` | `npm install` was never run in `backend/` | `npm install` in `backend/` |
| Frontend loads but every request 404s / "Network Error" | The API is not running, or `VITE_API_URL` points somewhere wrong | Start the backend on 5050; keep `VITE_API_URL` empty so the client uses `http://localhost:5050` |
| CORS error in the browser console | `CLIENT_URL` in `backend/.env` does not match the frontend origin | Set `CLIENT_URL=http://localhost:5173` |
| `Too many authentication attempts. Please try again later.` | `AUTH_RATE_LIMIT_MAX` (default 10 per 15 min) exceeded | Wait, or raise `AUTH_RATE_LIMIT_MAX` in `backend/.env` and restart |
| `Too many registration attempts. Please try again later.` | `REGISTRATION_RATE_LIMIT_MAX` (default 5 per 60 s) exceeded | Wait, or raise `REGISTRATION_RATE_LIMIT_MAX` |
| `GET /api/registrations/:id/refund-status` → `404 Route not found` | **By design** — the route is commented out because the handler does not exist (5.1) | Nothing to fix; it is a known unimplemented endpoint |
| Live registration counts / notifications never arrive | **By design** — `initSocket` is imported but never called (5.2) | Nothing to fix without a code change |
| `npm test` fails while downloading a MongoDB binary | `mongodb-memory-server` needs internet and a writable cache dir | Allow the download, or set `MONGOMS_DOWNLOAD_DIR`; check proxy settings |
| `npx playwright test` cannot reach the backend | The `webServer` block starts the backend with `cd ../backend && npm run dev` | Make sure `backend/.env` exists **and** MongoDB is up before running the suite |
| `npx playwright test` only runs 3 tests | `playwright.config.js` sets `testDir: './e2e'`; the specs in `Frontendd/tests/` are outside it | Expected — see 4.2 |
| `npm run lint` reports many errors | The repo has committed lint logs (`lint.json`, `lint_log.txt`, `lint_output.txt`, `lint_errors.json`, `lint_log_2.txt`, `lint_log_final.txt`) from earlier runs | Read those logs for the baseline; `eslint.config.js` uses `warn` for `no-unused-vars`, so warnings do not fail CI |
| `docker compose up` gives you a site but no API | `Frontendd/docker-compose.yml` defines **only** the nginx `web` service | Run MongoDB and the backend separately |
| `pm2 start src/index.js` (as the README says) fails | There is no `src/index.js`; the entry is `src/server.js` | Use `pm2 start src/server.js` — or ignore the README, it predates the current layout |
| README says `cd frontend`, `MONGODB_URI`, `CLIENT_ORIGIN` | The README is stale — the folder is **`Frontendd`**, and the code reads **`MONGO_URI`** and **`CLIENT_URL`** | Follow this document, not the README |

**Known limitations to state honestly**

* **Two endpoints are genuinely unimplemented and are disabled in code.**
  `backend/src/routes/registrationRoutes.js:30-36` contains:

  ```javascript
  // End point to check refund status
  // NOTE: checkRefundStatus handler is not implemented in registrationController.js.
  // Left disabled (rather than inventing behaviour) — see mobile-app-refinement-report.md.
  // router.get("/:id/refund-status",authenticate,checkRefundStatus);
  // End point to check refund policy
  // NOTE: checkRefundPolicy handler is not implemented in registrationController.js.
  // router.get("/:id/refund-policy",authenticate,checkRefundPolicy)
  ```

  The handlers `checkRefundStatus` and `checkRefundPolicy` **do not exist** in
  `registrationController.js` — the module exports `registerForEvent`, `myRegistrations`,
  `participantsForEvent`, `checkInParticipant`, `exportParticipantsCsv`, `checkRegistrationStatus`,
  `promoteFromWaitlist` and `cancelRegistration`. Both routes therefore answer
  **`404 Route not found`**. Also note the comment points at `mobile-app-refinement-report.md`,
  **which is not present in this repository**.

  To be fair to the repo: the refund feature is **half-built, not absent**.
  `backend/src/utils/refundPolicy.js` exports a working `calculateRefund(eventDate, amount)`
  (no refund inside 24 h, 50% between 2 and 7 days, 100% beyond 7 days); `registrationController.js:9`
  imports it — **and never calls it**; the `Registration` model has `refundId`, `refundStatus`,
  `refundAmount` and `refundedAt` (`backend/src/models/Registration.js:16-19`); and `seed.js` creates
  three refund test events and prints a "Refund Test Cases" legend (`seed.js:392-435`).
  **Only the two HTTP endpoints are missing.**
* **`initSocket` is imported but never called.** `backend/src/server.js:14` has
  `import { initSocket } from './services/socket.js';` and nothing calls it — `initSocket(server, clientOrigin)`
  is defined at `services/socket.js:11` but is never invoked. The Socket.IO server is therefore
  **never created**, and the emitters `emitRegistrationCount` / `emitNotification` short-circuit on
  `!ioInstance` (`socket.js:54`, `socket.js:65`). **All realtime features are dead.** The frontend
  still ships `socket.io-client` and CI still waits on the API.
* **Duplicate route mounting.** `backend/src/app.js:46-53` mounts every router and installs a 404
  catch-all; `backend/src/server.js:23-34` then mounts the **same** routers again and installs a
  second 404 handler. Because `app.js` is imported first, its catch-all runs first and the mounts in
  `server.js` are effectively dead code. It is harmless but confusing.
* **The server never connects to MongoDB.** `backend/src/server.js:45` is `//await connectDB();`.
  `connectDB` is imported but commented out, so the API process starts, listens on 5050 and prints
  "Server running on …" even with **no database at all** — and then every database-backed request
  fails. `backend/src/seed.js:150` *does* call `connectDB()`, so the seeder behaves differently from
  the server.
* **`API_RATE_LIMIT_MAX` is a dead environment variable** (`app.js:34` hardcodes `max: 120`).
* **The Vite proxy is configured but unused.** `Frontendd/vite.config.js:74-87` proxies `/api` and
  `/uploads` to `http://localhost:5050`, and both `Frontendd/.env.example` and the CI comment at
  `.github/workflows/ci.yml:158-161` tell you that the proxy handles `/api`. In reality every request
  in `Frontendd/src/` is built from `API_BASE_URL` (`Frontendd/src/config.js:2-6`), which defaults
  to `http://localhost:5050` — so the browser calls the API **directly and cross-origin**, and the
  proxy never sees a request. The default still works, but only because the backend's CORS origin
  is `CLIENT_URL`.
* **Two different API-URL environment variable names.** `Frontendd/src/config.js` reads
  `VITE_API_URL`; `Frontendd/src/CoOrganizerPanel.jsx:3` reads `VITE_API_BASE_URL` and falls back
  to `http://localhost:5050`. Setting only one of them leaves the other pointing at localhost.
* **The frontend's role guard disagrees with the backend's role names** (`attendee` vs `customer`).
* **Four Playwright specs in `Frontendd/tests/` never run** because `testDir` is `./e2e`.
* **The frontend README is a single line** (`# SAAS-Landing`) and the root README documents a
  `frontend/` folder, `MONGODB_URI`, `CLIENT_ORIGIN` and `src/index.js` — **none of which match the
  code**.
* **Five `.bak` files** from the merge repair remain in `backend/src/` (2.6). They are inert but
  contain the known-broken code.
* **No `node_modules/` anywhere** and **no MongoDB and no Docker installed on this machine**, so
  nothing here has been run end-to-end. Every runtime statement above is read from the source.
* **There is no mobile/native client.** The QR *scanning* UI (`html5-qrcode`) runs in the browser via
  `getUserMedia`, which requires a secure context — `http://localhost` is allowed, a plain-HTTP LAN
  address is not.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Environment and configuration**

- [ ] `node --version` prints a version ≥ 18
- [ ] `backend/.env` exists and contains a non-placeholder `JWT_SECRET`
- [ ] `backend/.env` `MONGO_URI` points at a MongoDB you have actually started
- [ ] `backend/.env` `CLIENT_URL` is `http://localhost:5173`
- [ ] `Frontendd/.env` is either absent or has an empty `VITE_API_URL` (so the client uses
      `http://localhost:5050` directly)
- [ ] `mongod` / a MongoDB Atlas URI / a Docker `mongo:6` container is running and reachable on
      `127.0.0.1:27017`
- [ ] `npm install` completed in **both** `backend/` and `Frontendd/` (no `node_modules/` was present
      before you started)

**Backend**

- [ ] `npm run dev` prints `Server running on http://localhost:5050`
- [ ] `curl.exe -s -o NUL -w "HTTP %{http_code}" http://localhost:5050/api/events` returns `HTTP 200`
- [ ] `GET /api/events` returns the seeded events (after `npm run seed`)
- [ ] The `morgan` request log shows the frontend's proxied `/api/...` calls arriving on 5050
- [ ] You have confirmed whether `connectDB()` is still commented out in `server.js:45` and, if so,
      that DB-backed routes work (or fail) accordingly
- [ ] `POST /api/auth/login` with the seeded credentials returns a JWT
- [ ] `GET /api/registrations/me` with `Authorization: Bearer <token>` returns the user's registrations
- [ ] `GET /api/registrations/:id/refund-status` returns `404 Route not found` (expected — the
      endpoint is intentionally disabled)
- [ ] `GET /api/registrations/:id/refund-policy` returns `404 Route not found` (expected)
- [ ] You have confirmed that `initSocket` is never called and that realtime updates therefore do
      **not** arrive

**Tests**

- [ ] `npm test` in `backend/` completes and reports a pass/fail summary (it downloads a MongoDB
      binary on first run)
- [ ] `npm run lint` in `Frontendd/` completes
- [ ] `npm run build` in `Frontendd/` produces a `dist/` folder
- [ ] `npx playwright test --reporter=list` in `Frontendd/` runs the 3 `e2e/smoke.spec.js` tests
- [ ] You have noted that the 4 specs in `Frontendd/tests/` are **not** executed by that command

**Frontend (manual, http://localhost:5173)**

- [ ] `/` renders the landing page
- [ ] `/signup` creates an account and `/login` signs in with `customer@example.com` / `password`
- [ ] The Events page loads data from the API at `http://localhost:5050` (cross-origin from 5173)
- [ ] Registering for an event returns a QR code and increments the participant count
- [ ] The PDF ticket downloads and contains the QR code
- [ ] `/organizer/dashboard` shows the participant list and the CSV export works
- [ ] `/organizer/scan/:eventId` opens the QR scanner (camera permission prompt)
- [ ] `/admin/dashboard` lists pending events for approval
- [ ] You have noted that `/customer/dashboard` redirects a `customer`-role user away (guard expects
      `attendee`)

**Cleanup**

- [ ] Both dev servers were stopped with `Ctrl+C`
- [ ] `Get-NetTCPConnection -State Listen -LocalPort 5050,5173,27017 -ErrorAction SilentlyContinue`
      shows nothing unexpected still bound
- [ ] `backend/.env` and `Frontendd/.env` were **not** committed (both are git-ignored)
- [ ] No Cloudinary or SMTP credentials were pasted into a commit or a shared document

# Carden (flashcards-with-spaced-repetition) — Setup & Test Workflow

This document covers how to install, configure, run and test **Carden** — a spaced-repetition
flashcard tool that turns web pages you read into flashcards, schedules them with the SM-2
algorithm, and gamifies the result with points, levels and streaks.

**This is not a mobile app.** It has nothing to do with Android or iOS. It is a two-part
desktop-web project:

| Part | Folder | What it is | Stack |
|---|---|---|---|
| Browser extension | `chrome-extension/` | The whole user-facing product: popup, overlay, context menu, stats and settings pages | **Chrome Extension, Manifest V2**, version `1.0.4` — plain HTML/CSS/JS, jQuery 3.5.1, jQuery Nice Select, Chart.js, ExtensionPay |
| Backend API | `server/` | 18 PHP endpoints over a MySQL database (cards, decks, users) | PHP 8 + `mysqli`, MySQL (schema in `server/schema.sql`) |

**Honest scope note up front:** `project-metadata.json` claims the stack is *"React Native;
SQLite"* with the entry point `server/add_card.php`. **That metadata is wrong about the
stack.** There is no React Native, no React, no SQLite and no build toolchain of any kind in
this repository — no `package.json`, no `node_modules`, no `pubspec.yaml`, no Gradle. The real
stack is a Manifest V2 Chrome extension talking to a PHP/MySQL backend. The metadata's
`entry` field does point at a real file (`server/add_card.php`), but the *primary* entry point
for a user is `chrome-extension/manifest.json`.

**Honest scope note #2 — the big one:** Manifest V2 is **dead in modern Chrome**. Per Google's
own deprecation timeline, MV2 was disabled for every user on every channel in **Chrome 138
(24 July 2025)** with no way to re-enable it; the enterprise escape hatch
(`ExtensionManifestV2Availability`) was removed in **Chrome 139**; and the last developer flags
were deleted in **Chrome 151 (28 July 2026)**. Separately, on **31 August 2026** every remaining
MV2 extension was removed from the Chrome Web Store. The Chrome installed on this machine is
**155.0.8059.85**, so this extension **cannot be loaded in it at all**. Section 5 explains the
workarounds. Everything in Section 4 that requires the extension is therefore marked
**unverified** — it could not be exercised here.

**Honest scope note #3:** `server/config.php` ships **literal placeholders**
(`mysqli_connect("IP","username","password","database")`). There is no `.env`, no
`.env.example`, no installer and no schema bootstrap script. You must supply your own MySQL
credentials and run `server/schema.sql` yourself.

**Honest scope note #4:** there is **no test suite** — no PHPUnit, no JS test runner, no CI. The
only CI file in the whole repository is `.github/FUNDING.yml`. Section 4 is therefore a set of
manual and `curl.exe` smoke checks.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 works. Nothing here is platform-specific beyond the path separators | `systeminfo` |
| **PHP** | 8.x with the `mysqli` and `session` extensions. Installed here: **8.4.8 (ZTS, x64)** at `C:\Program Files\php-8.4.8\php.exe` | `php -v`, `php -m` |
| **MySQL** | 5.7+ / 8.x. Installed here: **MySQL Server 8.0** (`mysql.exe` and `mysqld.exe` under `C:\Program Files\MySQL\MySQL Server 8.0\bin`) | `mysql --version` |
| **MySQL service** | Windows service name `MYSQL80`. **Installed but currently `Stopped`, `StartType: Manual`**; data directory `C:\ProgramData\MySQL\MySQL Server 8.0\Data` exists | `Get-Service MYSQL80` |
| **A web server that can run PHP** | XAMPP/Apache, or the PHP built-in server (`php -S`). **XAMPP is only a stub on this machine** — `C:\xampp` contains a single `phpMyAdmin` folder, **no Apache, no bundled PHP, no bundled MySQL** | `Get-ChildItem C:\xampp` |
| **Chrome** | Needed to load the extension — but see the MV2 blocker. Installed here: **155.0.8059.85** | `(Get-Item "C:\Program Files\Google\Chrome\Application\chrome.exe").VersionInfo.ProductVersion` |
| **A Chrome ≤ 137** (or Chrome for Testing / Chromium snapshot) | **Required to load this MV2 extension at all.** Not present on this machine | — |
| Node.js / npm | **Not needed.** The extension ships vendored `jquery-3.5.1.min.js`, `jquery.nice-select.min.js`, `chart.min.js` and `ExtPay.js` | `Test-Path node_modules` |
| Internet | Only for the ExtensionPay subscription flow and the Chart.js CDN fallback | — |
| A GitHub token / OAuth client | `manifest.json` has `"oauth2": { "client_id": "CLIENT_ID" }` — a **placeholder**. Only the paid tier uses it | `chrome-extension/manifest.json:9-11` |

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\flashcards-with-spaced-repetition"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 There is nothing to install from a package manager

This project has **no dependency manifest and no build step**. Both halves ship as-is:

- `chrome-extension/` is a plain folder of HTML/CSS/JS with a `manifest.json`. Chrome loads it
  directly from disk.
- `server/` is 18 standalone `.php` files plus `server/schema.sql`. There is no Composer
  project — no `composer.json`, no `vendor/`. The only PHP APIs used are `mysqli` and
  `session_start()`, both of which are enabled in the installed PHP 8.4.8 build (verified with
  `php -m`).

Verified: `Get-ChildItem $root -Force` returns `.git`, `.github`, `chrome-extension`, `server`,
`.gitattributes`, `LICENSE`, `README.md`, `project-metadata.json` — **no `package.json`,
no `composer.json`, no `pubspec.yaml`, no `node_modules`, no `vendor`**.

#### 2.2 Start MySQL and create the database

The `MYSQL80` service is installed but **stopped**. Start it (Administrator PowerShell):

```powershell
Start-Service -Name "MYSQL80"
Get-Service -Name "MYSQL80" | Select-Object Name, Status
```

Then create the schema. `server/schema.sql` is a phpMyAdmin 4.9.5 dump that creates three
MyISAM/latin1 tables:

| Table | Key columns |
|---|---|
| `cards` | `id` (AUTO_INCREMENT), `question`, `answer`, `source`, `user`, `repetitions`, `ease`, `action`, `nextdate` (date), `deck`, `correct`, `incorrect`, `forgotten` |
| `decks` | `id` (AUTO_INCREMENT), `name`, `user` |
| `users` | `id` (AUTO_INCREMENT), `user_id`, `level`, `points`, `streak`, `cards`, `session_dates`, `session_correct`, `session_incorrect`, `session_forgotten` |

Import it with the MySQL client:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "CREATE DATABASE carden CHARACTER SET latin1;"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p carden < "$root\server\schema.sql"
```

> The `<` redirect is **not** PowerShell syntax. Use `cmd.exe` for that line, or pipe the file
> in with `Get-Content`:
>
> ```powershell
> Get-Content -LiteralPath "$root\server\schema.sql" -Raw |
>     & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p carden
> ```

#### 2.3 Fill in the database credentials — `server/config.php`

`server/config.php` is **8 lines** and contains placeholders:

```php
<?php
    $conn = mysqli_connect("IP","username","password","database");

    // Check connection
    if (mysqli_connect_errno()) {
        echo "Failed to connect to MySQL: " . mysqli_connect_error();
    }
?>
```

You must replace the four arguments on line 2 with your real values. For the local MySQL 8.0
above:

```php
<?php
    $conn = mysqli_connect("127.0.0.1", "root", "<your-password>", "carden");

    // Check connection
    if (mysqli_connect_errno()) {
        echo "Failed to connect to MySQL: " . mysqli_connect_error();
    }
?>
```

**Do not commit a filled-in `config.php` with a real password.** The repository has a `.git`
directory and `config.php` is tracked, so the credential would land in history.

**Important PHP 8 behaviour you must know about (verified here).** The `if
(mysqli_connect_errno())` guard on line 5 is **dead code on PHP 8.1+**. Since PHP 8.1 the
default `mysqli` error mode is `MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT`, so a failed
connect **throws** `mysqli_sql_exception` *before* line 5 is ever reached. With the shipped
placeholders, running the file produces:

```
Warning: mysqli_connect(): php_network_getaddresses: getaddrinfo for IP failed: No such host is known in ...\server\config.php on line 2

Fatal error: Uncaught mysqli_sql_exception: php_network_getaddresses: getaddrinfo for IP failed: No such host is known in ...\server\config.php:2
Stack trace:
#0 ...\server\config.php(2): mysqli_connect()
#1 {main}
  thrown in ...\server\config.php on line 2
```

Exit code `255`. Because every endpoint does `require 'config.php';` as its **second** line,
**all 17 endpoints return HTTP 500 until the credentials are correct.** If you want the
guard to work as originally intended, wrap the call:

```php
mysqli_report(MYSQLI_REPORT_OFF);
```

…or catch the exception. Either way, correct credentials are the real fix.

#### 2.4 Serve the `server/` folder over HTTP

The extension must reach the endpoints over HTTP(S) — a `file://` origin will not work, and
the extension's `Access-Control-Allow-Origin` header only allows the extension origin.

**Option A — the PHP built-in server (simplest, verified working on this machine):**

```powershell
Set-Location "$root\server"
php -S 127.0.0.1:8087 -t .
```

Keep that window open. The server prints:

```
[Thu Oct 22 2026 04:35:41 GMT] PHP 8.4.8 Development Server (http://127.0.0.1:8087) started
```

**Option B — XAMPP/Apache:** copy or symlink the `server/` folder into `C:\xampp\htdocs\carden`
and use `http://localhost/carden/`. XAMPP is **not** properly installed here (only
`phpMyAdmin` exists), so Option A is the working path on this machine.

**Option C — any PHP-capable host:** the code is plain PHP with no framework, so a shared
hosting plan works too.

#### 2.5 Replace the relative API URLs in the extension — this is mandatory

Every PHP call in the extension's JavaScript uses a **relative** path of the form
`../../server/<endpoint>.php`. Verified locations:

| File | Calls |
|---|---|
| `chrome-extension/js/popup.js` | `chrome_login.php`, `get_level.php`, `get_stats.php`, `add_cards.php` (×2), `export_cards.php` (×2), `add_card.php`, `get_decks.php`, `add_deck.php` |
| `chrome-extension/js/overlay.js` | `get_cards.php`, `get_level.php`, `set_next_date.php` |
| `chrome-extension/js/context.js` | `add_card.php` (×2), `get_decks.php` |
| `chrome-extension/js/edit.js` | `load_cards.php` (×2), `get_decks.php`, `delete_card.php`, `update_card.php` |
| `chrome-extension/js/editdeck.js` | `get_decks.php`, `delete_deck.php`, `update_deck.php`, `update_card_deck.php` |
| `chrome-extension/js/background.js` | `get_cards.php`, `get_level.php` (raw `XMLHttpRequest`) |

Those relative paths **do not resolve to your server**. Inside an extension page they resolve
against the extension origin (`chrome-extension://<id>/…`), and Chrome clamps `..` at the
package root, so `../../server/get_cards.php` becomes
`chrome-extension://<id>/server/get_cards.php` — a path that does not exist inside
`chrome-extension/` (and is not in `web_accessible_resources` either). Inside a **content
script** (`js/content.js`, injected into every page via `<all_urls>`) the same relative path
instead resolves against the **visited web page's** origin, which is just wrong.

Replace every occurrence with an absolute URL. With the built-in server from 2.4:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\flashcards-with-spaced-repetition"
$base = "http://127.0.0.1:8087"

Get-ChildItem -LiteralPath "$root\chrome-extension\js" -File |
    Where-Object { $_.Name -notlike "*.min.js" } |
    ForEach-Object {
        $text = Get-Content -LiteralPath $_.FullName -Raw
        $new  = $text -replace '\.\./\.\./server/', "$base/"
        if ($new -ne $text) {
            Set-Content -LiteralPath $_.FullName -Value $new -Encoding utf8 -NoNewline
            Write-Output "patched: $($_.Name)"
        }
    }
```

That writes into the working tree, so review the diff before you commit it.

#### 2.6 The CORS header and the extension ID

All 17 endpoint files send the same header (verified, one per file):

```php
header("Access-Control-Allow-Origin: chrome-extension://effdlfnfholapaddppkjmkhmfgdbeomj");
```

That is the ID of the published Carden extension (the README links to
`chrome.google.com/webstore/detail/carden-flashcards-with-sp/effdlfnfholapaddppkjmkhmfgdbeomj`).
`chrome-extension/manifest.json` includes a `key` field (line 8), which Chrome uses to derive a
**stable** ID for an unpacked extension — so a local load should reproduce
`effdlfnfholapaddppkjmkhmfgdbeomj`. If your unpacked ID comes out different, you must update
the `Access-Control-Allow-Origin` line in **all 17** PHP files to your ID, or every request
will be blocked by CORS.

> The header lists only one origin and there is no `Access-Control-Allow-Methods` /
> `Access-Control-Allow-Headers` — which is fine here because the extension only ever sends
> `application/x-www-form-urlencoded` POSTs, which are CORS "simple requests" that need no
> preflight.

#### 2.7 Other placeholders you will hit

| Placeholder | File | Effect |
|---|---|---|
| `"client_id": "CLIENT_ID"` | `chrome-extension/manifest.json:10` | The `oauth2` block is a stub. Only the paid tier (`ExtPay`) uses OAuth; the free tier uses the `identity` API. |
| `extpay` / ExtensionPay | `chrome-extension/js/background.js:1`, `js/ExtPay.js` | The subscription gate. `background.js` calls `ExtPay('effdlfnfholapaddppkjmkhmfgdbeomj')`. Without a real ExtensionPay account the paid path is inert; the free path still works. |
| `content_security_policy` | `chrome-extension/manifest.json:25` | Allows `https://www.gstatic.com/charts/loader.js` and `https://extensionpay.com` in addition to `'self'`. |

#### 2.8 Line endings

`.gitattributes` contains only:

```
# Auto detect text files and perform LF normalization
* text=auto
```

So the repository normalises to LF on checkout. On Windows, Git for Windows will check the
`.php` and `.js` files out with LF (or convert to CRLF depending on your `core.autocrlf`);
either way PHP and Chrome do not care.

---

### 3. Launch the Complete Project

Carden is **two processes**: the PHP server and the browser running the extension. Start the
server first.

#### 3.1 Start the PHP backend

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\flashcards-with-spaced-repetition\server"
php -S 127.0.0.1:8087 -t .
```

Leave it running. Stop with `Ctrl+C`.

#### 3.2 Load the extension in Chrome

1. Open `chrome://extensions/`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the folder `N:\Foundev-Projects\Domain\Mobile App Development\flashcards-with-spaced-repetition\chrome-extension`
   — the folder that contains `manifest.json`, **not** a ZIP of it.
5. Pin **Carden** from the extensions (puzzle) icon in the toolbar.

**On Chrome 155 this step will fail.** See Section 5 for what "fail" looks like and what to
use instead.

#### 3.3 First-run flow inside the extension

1. Open the popup. The extension calls `chrome_login.php` with the Chrome profile's
   `identity.email` as `auth_id`; the server creates a `users` row if the email is unknown
   (`server/chrome_login.php` echoes `"no"` for a new user, `"yes"` for a known one).
2. The extension then pulls the level/points/streak (`get_level.php`) and the due cards
   (`get_cards.php`, `SELECT … WHERE user='$auth' AND nextdate <= NOW()`).
3. **Right-click any text on a web page** → the context menu offers the flashcard overlay
   (`js/context.js` → `add_card.php`).
4. **Settings** (`html/settings.html`) is where decks are managed (`get_decks.php`,
   `add_deck.php`, `delete_deck.php`, `update_deck.php`).
5. **Stats** (`html/stats.html`) renders the Chart.js charts from `get_stats.php`.

#### 3.4 Ports

| Component | Port | Address | Source |
|---|---|---|---|
| PHP built-in server (recommended local path) | **8087** (any free port you pick) | `http://127.0.0.1:8087` | your `php -S` command |
| Apache under XAMPP (if you install it) | **80** / **443** | `http://localhost/carden/` | XAMPP default |
| MySQL Server 8.0 | **3306** | `127.0.0.1:3306` | MySQL default |
| Chrome DevTools "Load unpacked" | n/a | `chrome://extensions/` | — |

---

### 4. Test the Project

> **There is no automated test suite.** No PHPUnit, no Jest, no Mocha, no CI workflow. The
> only CI file in the repository is `.github/FUNDING.yml`. Everything below is a manual or
> `curl.exe` check.
>
> **Nothing in 4.2–4.5 could be executed here** because the extension cannot be loaded in
> Chrome 155 (Section 5). Those steps are labelled **unverified**.

#### 4.1 Backend smoke tests with `curl.exe` — verified as far as the credentials allow

Start the server (3.1) and, with correct credentials in `config.php`:

```powershell
# New user is created on first login -> "no"
curl.exe -s -X POST -d "auth_id=dana@example.com" "http://127.0.0.1:8087/chrome_login.php"

# Same user again -> "yes"
curl.exe -s -X POST -d "auth_id=dana@example.com" "http://127.0.0.1:8087/chrome_login.php"

# Level / points / streak for the user (JSON array)
curl.exe -s -X POST -d "auth_id=dana@example.com" "http://127.0.0.1:8087/get_level.php"

# Decks for the user
curl.exe -s -X POST -d "auth_id=dana@example.com" "http://127.0.0.1:8087/get_decks.php"

# Cards due today (0 when there are none)
curl.exe -s -X POST -d "auth_id=dana@example.com&deck=0" "http://127.0.0.1:8087/get_cards.php"
```

Expected shapes (read from the PHP, not from a live run):

| Endpoint | Response |
|---|---|
| `chrome_login.php` | the literal string `no` (new user) or `yes` (known user) |
| `get_level.php` | JSON array `[level, points, streak, total_cards, correct, incorrect, forgotten]` |
| `get_cards.php` | JSON array of `{id,q,a,s,nextdate,repetitions,ease}`, or the literal `0` when nothing is due |
| `add_card.php` / `add_cards.php` | `Success` |
| `delete_card.php` / `delete_deck.php` / `update_*.php` | depends on the endpoint; check the file |
| `export_cards.php` | the export payload consumed by `popup.js` |
| `set_next_date.php` | `done`, `done1`, or `no cards` |

> **curl quote-mangling on Windows.** `curl.exe` is a native binary and PowerShell's argument
> parser strips double quotes before the process sees them, so an inline
> `-d "{\"a\":\"b\"}"` arrives malformed. For any JSON body, write the body to a file first
> and use `--data-binary "@file"` — **the `@` and the quotes around the file name are both
> required** (curl's "read the body from this file" syntax):
>
> ```powershell
> $body = @{ auth_id = "dana@example.com"; deck = 0 } | ConvertTo-Json
> $body | Set-Content -LiteralPath "$env:TEMP\carden_body.json" -Encoding utf8
> curl.exe -s -X POST -H "Content-Type: application/json" --data-binary "@$env:TEMP\carden_body.json" "http://127.0.0.1:8087/get_cards.php"
> ```
>
> The form-encoded examples above do not need this, because `-d "auth_id=..."` has no inner
> quotes to mangle. `Invoke-RestMethod` is the PowerShell-native alternative and needs no
> escaping at all:
>
> ```powershell
> Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8087/get_decks.php" -Body @{ auth_id = "dana@example.com" }
> ```

**What was actually verified here:** with the shipped placeholder credentials, every one of
these requests returns **HTTP 500 Internal Server Error** with an empty body, because
`require 'config.php'` fatals on the unresolvable host `IP` (Section 2.3). After you fill in
real credentials and start MySQL, they should return the shapes above — **that part is
unverified**.

#### 4.2 Database sanity check

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p carden -e "SELECT id, question, answer, user, deck, nextdate FROM cards;"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p carden -e "SELECT id, name, user FROM decks;"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p carden -e "SELECT id, user_id, level, points, streak, cards FROM users;"
```

The `users` row for your Chrome email should exist after the first popup open, with
`level = 1`, `points = 0`, `streak = 0`.

#### 4.3 Extension load test — **unverified on this machine**

1. `chrome://extensions/` → Developer mode on → **Load unpacked** → pick `chrome-extension/`.
2. The extension card shows **"Carden - Flashcards with Spaced Repetition"**, version
   **1.0.4**, and **no red error badge**.
3. The extension ID in the card's URL must be
   `chrome-extension://effdlfnfholapaddppkjmkhmfgdbeomj/`.
4. Open the popup → the DevTools console must show **no red CORS errors** and no 404s to
   `http://127.0.0.1:8087/...`.
5. Pin it from the puzzle icon.

#### 4.4 Functional walkthrough — **unverified on this machine**

| Step | Expected result |
|---|---|
| Open the popup | The "log in" view; the extension calls `chrome_login.php` and creates your `users` row |
| Select text on any page → right-click → "Add flashcard" | The overlay (`html/overlay.html`) opens with the selected text pre-filled |
| Fill question / answer / source and save | `add_card.php` answers `Success`; the card appears in the extension's deck list |
| Open the study overlay (`overlay.js`) | The due card is shown; the next review date comes from `nextdate` |
| Answer the card correct / incorrect / forgotten | `set_next_date.php` returns `done`; `repetitions` increments and `nextdate` moves forward |
| Reopen the popup | Level / points / streak updated (`get_level.php`) |
| Settings → create a deck | `add_deck.php`; the deck appears in the dropdown (`get_decks.php`) |
| Stats page | Chart.js charts render from `get_stats.php` |
| Settings → Export | `export_cards.php` returns the export payload |

#### 4.5 The CORS check — **unverified on this machine**

From the popup's DevTools console, run:

```javascript
fetch("http://127.0.0.1:8087/get_level.php", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "auth_id=dana@example.com"
}).then(r => r.text()).then(console.log)
```

If the response comes back `null` (a CORS failure) the `Access-Control-Allow-Origin` header
does not match your extension's ID — fix 2.6.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **"Manifest version 2 is deprecated" / the extension refuses to load / the Load unpacked button reports the extension as unsupported** | **The #1 blocker.** MV2 was disabled for all users in Chrome 138 (24 Jul 2025), the enterprise `ExtensionManifestV2Availability` policy was removed in Chrome 139, and the last developer flags were deleted in Chrome 151 (28 Jul 2026). Chrome 155 is installed here. | Use a browser that still accepts MV2 — see the options under "Known limitations" below. |
| Every endpoint returns **HTTP 500** with an empty body | `server/config.php` still has the placeholder host `IP`; on PHP 8.1+ `mysqli_connect()` **throws** before the `mysqli_connect_errno()` guard can run | Fill in real credentials (2.3) and start MySQL (2.2) |
| `Fatal error: Uncaught mysqli_sql_exception: ... getaddrinfo for IP failed` | Same as above, shown in the PHP CLI | Same as above |
| `Failed to connect to MySQL: ...` printed instead of a fatal error | You are on PHP ≤ 8.0, where `mysqli_connect()` returns `false` instead of throwing | Also fix the credentials — the message is the symptom, not the cause |
| `mysqli_connect(): ... Access denied for user` | Wrong username/password, or the MySQL user has no rights on the `carden` database | `GRANT ALL ON carden.* TO 'youruser'@'localhost';` and re-check `config.php` |
| `Service MYSQL80 is not running` / `Can't connect to local MySQL server` | The MySQL service is stopped (it is `StartType: Manual` here) | `Start-Service -Name "MYSQL80"` |
| The extension loads but every request fails with `net::ERR_CONNECTION_REFUSED` | The PHP server is not running, or the URLs still point at `../../server/...` | Start the server (3.1) and patch the URLs (2.5) |
| Requests fail with `net::ERR_FILE_NOT_FOUND` or a 404 on `chrome-extension://<id>/server/...` | The relative `../../server/` paths were not replaced | Do 2.5 — all relative paths must become absolute `http://host:port/` URLs |
| Console shows `Access to fetch at '…' has been blocked by CORS policy` | Your unpacked extension ID differs from `effdlfnfholapaddppkjmkhmfgdbeomj` | Update `Access-Control-Allow-Origin` in all 17 PHP files (2.6) |
| The popup says "logged in" but no cards appear, and `get_cards.php` returns `0` | No cards are due today (`nextdate <= NOW()`) — this is correct SM-2 behaviour, not a bug | Add a card, or check `SELECT nextdate FROM cards;` |
| The overlay does not appear on right-click | `content.js` runs on `<all_urls>`; it may be blocked on `chrome://` pages or on a page with a strict CSP | Test on a normal `https://` page |
| `chrome.identity` fails / no email returned | The `identity` permission plus the `identity.email` permission are Chrome-only; Firefox has no `chrome.identity` | Chrome or Chromium only |
| Extension icons look wrong | `manifest.json` points at `assets/extension-icons/logo-16.png`, `logo-48.png`, `logo-128.png`; all of those exist, alongside unused `-alert` variants | Nothing to do — this is expected |
| `composer` / `npm` commands are missing | **There is none.** The project has no dependency manifest | Nothing to do |
| The extension is not in the Chrome Web Store | All MV2 extensions were removed from the store on **31 Aug 2026** | Load it unpacked from a pre-MV2-dead browser |

**Known limitations to state honestly**

* **This is not a mobile app.** No Android, no iOS, no React Native, no Flutter. It is a
  browser extension plus a PHP/MySQL backend. `project-metadata.json`'s `"stack": "React
  Native; SQLite"` is **wrong**.
* **Manifest V2 no longer runs in modern Chrome.** This is not a configuration mistake you can
  work around in Chrome 155 — the capability was removed from the browser, not disabled by a
  policy. Realistic options: (a) run **Chrome for Testing** / a Chromium snapshot pinned to
  **≤ Chrome 137** in a separate profile, (b) install an older Chrome release side-by-side,
  (c) port the extension to Manifest V3 — a genuine migration, because `background.js` uses
  `ExtPay.js` (an MV2 background page), the manifest uses `browser_action` (→ `action`), and
  the content script is injected on `<all_urls>` with inline jQuery (→ MV3's isolated world and
  `web_accessible_resources` rules). None of these were attempted or verified here.
* **No automated tests exist.** There is no PHPUnit config, no JS test runner and no CI
  workflow — `.github/` contains only `FUNDING.yml`. Section 4 is entirely manual.
* **No CI at all.** Nothing in this repository builds, tests or publishes automatically.
* **The backend has no authentication.** `auth_id` is the user's Chrome email, passed
  as a plain POST field and used directly in SQL string interpolation. There is no session
  token, no password and no verification that the caller owns that email. Any client that can
  reach the server can read and write another user's cards by sending their email. The
  `Access-Control-Allow-Origin` header limits browser-originated requests to the extension,
  but it is not an authorisation mechanism.
* **SQL injection is possible.** Every endpoint builds its SQL by interpolating `$_POST`
  values (`add_card.php:11`, `get_cards.php:10-12`, `set_next_date.php` and others). Do not
  expose this server to the public internet as-is.
* **`set_next_date.php` is very large and very repetitive** (it is the SM-2 bookkeeping and
  daily-session bookkeeping in one file). It uses `serialize()`/`unserialize()` on the
  `session_*` columns.
* **The `oauth2.client_id` is the placeholder `CLIENT_ID`** and the ExtensionPay integration
  is not configured with a real account, so the paid tier cannot be exercised.
* **`server/config.php` contains a password in plaintext** and is tracked by git. If you fill
  it in, do not commit it.
* **The published extension is gone from the Chrome Web Store** (all MV2 extensions were
  removed on 31 Aug 2026), so the README's "Get it now" link is dead.
* **The `README.md` self-hosting section has misnumbered steps** (it goes 1,2,3,4,5,6,7 then
  "4." again) and does not mention that step 5 (replacing the URLs) is mandatory rather than
  optional.
* **No `.env`, no `.env.example`, no `composer.json`, no `package.json`, no `pubspec.yaml`.**
  Everything must be configured by hand.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Environment**

- [ ] `php -v` prints PHP 8.x and `php -m` lists both `mysqli` and `session`
- [ ] `Get-Service MYSQL80` reports `Running`
- [ ] `mysql --version` prints a MySQL 8.x version
- [ ] You are using a browser that accepts Manifest V2 (Chrome/Chromium **≤ 137**, or Chrome
      for Testing pinned to such a build) — Chrome 155 on this machine will **not** load it
- [ ] You have confirmed there is no `package.json`, `composer.json` or `pubspec.yaml`, so
      there is nothing to `npm install`, `composer install` or `flutter pub get`

**Database**

- [ ] You have created the `carden` database and imported `server/schema.sql`
- [ ] `SHOW TABLES;` in the `carden` database lists `cards`, `decks` and `users`
- [ ] `server/config.php` line 2 contains your real host / user / password / database — and
      you have **not** committed it

**Backend**

- [ ] `php -S 127.0.0.1:8087 -t .` starts and prints the "Development Server ... started" line
- [ ] `curl.exe -s -X POST -d "auth_id=test@example.com" "http://127.0.0.1:8087/chrome_login.php"`
      returns `no` for a brand-new address (not a 500)
- [ ] The same request with the same address now returns `yes`
- [ ] `get_level.php` returns a JSON array with 7 elements
- [ ] `get_decks.php` returns a JSON array
- [ ] `get_cards.php` returns `0` when nothing is due, and a JSON array once a card exists
- [ ] `add_card.php` returns `Success` and the row appears in the `cards` table
- [ ] `set_next_date.php` returns `done` and `repetitions` / `nextdate` changed in MySQL
- [ ] The `users` table has a row with your email, `level = 1`, `points = 0`, `streak = 0`

**Extension**

- [ ] Every `../../server/...` string in `chrome-extension/js/*.js` has been replaced with an
      absolute `http://host:port/...` URL
- [ ] `chrome://extensions/` → Developer mode → **Load unpacked** → `chrome-extension/` loads
      with **no error badge**, version `1.0.4`
- [ ] The extension ID is `effdlfnfholapaddppkjmkhmfgdbeomj`
- [ ] The popup's DevTools console shows **no CORS errors** and **no 404s**
- [ ] The popup opens, the user is created, and level / points / streak display

**Functional**

- [ ] Right-clicking selected text on a normal web page shows the flashcard overlay
- [ ] Saving a card shows `Success` and the card shows up in the deck list
- [ ] The study overlay loads the due card and records the answer (`set_next_date.php` → `done`)
- [ ] Creating and deleting a deck works from Settings
- [ ] The Stats page renders its charts
- [ ] Export produces a file you can re-import

**Cleanup**

- [ ] The PHP server was stopped with `Ctrl+C`
- [ ] `Get-NetTCPConnection -State Listen -LocalPort 8087 -ErrorAction SilentlyContinue` shows
      nothing still bound
- [ ] `git status` shows no accidental commit of a filled-in `server/config.php`

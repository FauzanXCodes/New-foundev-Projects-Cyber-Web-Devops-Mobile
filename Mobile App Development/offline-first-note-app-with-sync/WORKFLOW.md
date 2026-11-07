# todo (offline-first-note-app-with-sync) — Setup & Test Workflow

This document covers how to install, configure, run and test **todo** — an offline-first note
app. You type an idea, it is persisted on every keystroke, you can browse and filter your
notes, and multiple devices converge through a CRDT layer that uses a **GitHub repository as
dumb storage**.

**This one *is* a real app.** It is a genuine Flutter application with an Android target, a
web target, a real test suite and CI. But it is **not a "mobile app" in the usual sense of
an App Store product**: there is no iOS target at all (`ios/` is not in the repository and
`.metadata` lists only `root` and `web` as managed platforms), and the "desktop app" is
**the web build** served by a small local wrapper and opened in a Chrome `--app` window.
Flutter's Linux embedder was deliberately removed — it managed ~20 fps at 4K while the same
Dart code in Chrome sustained ~144 fps (`docs/DOCS-desktop-performance-findings.md`).

| Part | Folder | What it is |
|---|---|---|
| App | `lib/`, `android/`, `web/`, `assets/` | 121 Dart source files. Flutter package name **`todo`**, version `1.0.45+1` |
| Desktop wrapper | `bin/todo_desktop.dart`, `lib/desktop/` | Serves the built web bundle on a **fixed port 8730** and opens Chrome in `--app` mode with a fixed profile directory |
| Headless CLI | `bin/todo_note.dart`, `lib/cli/` | Adds/lists/reads/deletes notes from a terminal, as one more sync node |
| Tooling | `tool/`, `scripts/`, `docs/` | Sync smoke test, migration tools, repo-contract shell scripts, design docs |
| Tests | `test/` | 86 Dart test files covering data, sync, UI, CLI, desktop wrapper and attachments |

**Honest scope note up front — this project cannot be built or tested on this machine as
installed.** `pubspec.yaml` declares `environment: sdk: ^3.12.2`, but the Flutter on this
machine is **3.35.2 / Dart 3.9.0**. `flutter pub get` therefore fails during version
solving, before it downloads anything, and **no test, build or run command can work**. The
exact error was reproduced here — see 2.1. **FVM is not installed** either, and `.fvmrc`
pins Flutter **3.47.7**. Nothing in Section 4 that requires the toolchain has been executed,
and no test result is claimed anywhere in this document.

**Honest scope note #2:** `project-metadata.json` claims the stack is *"Flutter; Firestore"*.
**"Firestore" is wrong** — there is no Firestore client anywhere in the code. The sync
transport is a **GitHub repository used as blob storage** (`lib/sync/sync_service.dart` +
`lib/sync/github_client.dart` in the `crdt_sync` package), with a **Firebase Realtime
Database** REST client (`lib/sync/firebase_client.dart`, `firebase_backend.dart`) used for
the headless CLI session and for flushing analytics. The metadata's `entry` field,
`lib/main.dart`, is correct.

**Honest scope note #3:** the desktop path is **Linux-first**. `run.sh` is an Arch/Debian
bash script; `bin/todo_desktop.dart` requires the `HOME` environment variable (unset on
Windows); `findBrowser()` only looks for Linux Chrome binaries; the port guard shells out to
`ss -tlnp` and reads `/proc`; and the "address in use" errno is hard-coded to Linux's `98`.
All of these are detailed in Sections 2, 3 and 5.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | **Linux (Arch / Ubuntu-Debian)** for the documented desktop workflow. Windows works for the Android and web targets only, with the caveats in 3.4 | — |
| **Flutter** | **≥ 3.44.0** (from `pubspec.lock`'s `sdks:` block). `.fvmrc` pins **3.47.7**, and the release CI uses **3.47.7** too | `flutter --version` |
| **Dart** | **≥ 3.13.0** (`pubspec.lock`), and the package itself requires **`^3.12.2`** (`pubspec.yaml:22`) | `dart --version` |
| **Installed here (too old)** | Flutter **3.35.2** / Dart **3.9.0**, at `C:\Users\fauzan\Downloads\flutter_windows_3.35.2-stable\flutter` | `flutter --version` → `Flutter 3.35.2 • Tools • Dart 3.9.0` |
| **FVM** (Flutter Version Management) | **Recommended** — `.fvmrc` pins 3.47.7 and `flutter pub get` cannot succeed on 3.35.2. **NOT installed on this machine** (`Get-Command fvm` returns nothing) | `fvm --version` |
| Android SDK | **compileSdk 37** (`android/app/build.gradle.kts:26`), build-tools, NDK. Installed here: **SDK 34.0.0** with platforms `android-33` and `android-34` only, build-tools `33.0.1` / `34.0.0` — **API 37 is not installed** | `flutter doctor -v` |
| Java | **JDK 17** (`sourceCompatibility`/`targetCompatibility` = `VERSION_17`, CI uses Temurin 17). Installed here: OpenJDK **17.0.6** (Android Studio's JBR) | `java -version` |
| Android device / emulator | For `flutter run` on Android. **None connected** on this machine (`flutter doctor` lists Windows, Chrome and Edge only) | `flutter devices` |
| **Chrome / Chromium** | Needed by the desktop wrapper. Installed here: **Chrome 155.0.8059.85** at `C:\Program Files\Google\Chrome\Application\chrome.exe` | `flutter doctor -v` |
| A GitHub account + token | For sync. The token is stored in `flutter_secure_storage` on Android / `localStorage` on the web | — |
| `gh` CLI | **Optional** — only for `gh auth token` when running the sync smoke test | `gh --version` |
| `lcov` | **Optional** — `lcov --list coverage/lcov.info` to read a coverage report | `lcov --version` |
| Node.js / npm | **Not needed** | — |

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\offline-first-note-app-with-sync"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 The SDK-version blocker — read this first

`pubspec.yaml:21-22`:

```yaml
environment:
  sdk: ^3.12.2
```

`pubspec.lock` (tail):

```yaml
sdks:
  dart: ">=3.13.0 <4.0.0"
  flutter: ">=3.44.0"
```

`.fvmrc`:

```json
{
  "flutter": "3.47.7"
}
```

With the Flutter installed here (3.35.2 / Dart 3.9.0), `flutter pub get` **fails during
version solving**. Verified output (exit code `1`):

```
Resolving dependencies...
The current Dart SDK version is 3.9.0.

Because todo requires SDK version ^3.12.2, version solving failed.
Failed to update packages.
```

`.dart_tool/` was **not** created by the failed run, so the checkout is still pristine
(`git status` shows only the untracked `project-metadata.json` that the collection process
added).

**Everything downstream of `pub get` is therefore blocked:** `flutter test`,
`flutter analyze`, `flutter run`, `flutter build apk`, `flutter build web`,
`dart run tool/sync_smoke.dart` and `dart run bin/todo_note.dart` all fail with the same
message, because none of them can resolve `package:todo`'s dependencies.

**Fix — install a matching Flutter.** Two options:

```powershell
# Option A: FVM (matches .fvmrc exactly)
#   1. dart pub global activate fvm
#   2. fvm install 3.47.7
#   3. fvm use 3.47.7
#   4. fvm flutter pub get
# FVM is NOT installed on this machine, so all four steps are outstanding.

# Option B: plain SDK
#   Download Flutter 3.47.7 from the release archive, put its bin/ on PATH,
#   then confirm:  flutter --version   -> must report Dart 3.13+ and Flutter 3.47.7
```

> **Do not try to work around this by lowering the constraint.** `pubspec.yaml` says
> `^3.12.2` and `pubspec.lock` says `>=3.13.0 <4.0.0`; the code and the pinned dependency
> versions (`very_good_analysis ^11.0.0`, `flutter_secure_storage 11.2.0`,
> `google_sign_in 7.2.0`, `sqflite_common_ffi 2.4.4`) are written against that SDK. Editing
> the constraint to `^3.9.0` would produce a lockfile that no longer matches the code.

#### 2.2 Fetch the dependencies

Once the SDK matches:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\offline-first-note-app-with-sync"
flutter pub get
```

**Network access is required**, and it is not just pub.dev. Four of the dependencies are
**git-hosted**, all from the same repository `github.com/kuhyx/utils`, each pinned to a
branch:

| Package | Git ref | Path in the repo |
|---|---|---|
| `crdt_sync` | `crdt_sync_dart-v0.11.1` | `crdt_sync_dart` |
| `design_system` | `design_system-v0.2.1` | `design_system` |
| `github_device_auth` | `github_device_auth-v0.3.2` | `github_device_auth` |
| `sync_settings_ui` | `sync_settings_ui-v0.4.1` | `sync_settings_ui` |

`crdt_sync` is the CRDT engine (`LogStore`, record/log merge, GitHub transport);
`design_system` owns the theme tokens and shared components (there is deliberately **no**
local `theme.dart` that could drift from the frozen table).

The hosted dependencies, at their pinned versions:

| Package | Version | Package | Version |
|---|---|---|---|
| `cupertino_icons` | 2.0.0 | `open_file` | 4.0.0 |
| `file_picker` | 13.1.0 | `path` | 1.9.1 |
| `file_selector` | 1.1.0 | `path_provider` | 2.1.6 |
| `flutter_secure_storage` | 11.2.0 | `share_plus` | 13.3.1 |
| `google_sign_in` | 7.2.0 | `shared_preferences` | 2.5.6 |
| `http` | 1.6.0 | `sqflite_common_ffi` | 2.4.4 |
| `idb_shim` | 2.10.1+1 | `sqlite_crdt` | 3.0.4 |
| `image` | 4.12.0 | `url_launcher` | 6.3.3 |
| `image_picker` | 1.2.4 | `uuid` | 4.6.0 |
| | | `web` | 1.1.1 |

Dev dependencies: `fake_async 1.3.3`, `file_selector_platform_interface 2.7.0`,
`flutter_launcher_icons 0.14.4`, `flutter_test` (SDK), `plugin_platform_interface 2.1.8`,
`url_launcher_platform_interface 2.3.2`, `very_good_analysis ^11.0.0`.

#### 2.3 Platform plugins and what they need at runtime

| Plugin | Used for | Runtime requirement |
|---|---|---|
| `flutter_secure_storage` | Stores the GitHub sync token in the OS keystore (Android Keystore / libsecret) instead of plaintext `SharedPreferences` | Android only; needs the plugin registered in the Android build |
| `google_sign_in` | One-tap sign-in for the sync account | Android only. `crdt_sync` stays pure Dart so it keeps working on the headless Linux/CLI paths where the plugin does not exist (see `lib/sync/google_sign_in_backend.dart`) |
| `shared_preferences` | `nodeId`, the migration flag, `advancedMode` | All platforms |
| `sqflite_common_ffi` | The FFI SQLite path used by the legacy-DB import and by the test host | `sqfliteFfiInit()` is called for Linux/Windows/macOS in `lib/data/repository_factory_io.dart` |
| `sqlite_crdt` | **Retained only** to read the legacy on-device DB during the one-time migration in `NoteRepository.open` | Can be removed once every device has migrated |
| `image_picker` / `file_picker` / `file_selector` / `open_file` / `share_plus` / `url_launcher` / `image` | Attachments, camera/gallery picks, opening files, sharing | Android + web |

#### 2.4 Android configuration

`android/app/build.gradle.kts`:

| Setting | Value |
|---|---|
| `namespace` / `applicationId` | `dev.kuhy.todo` |
| `compileSdk` | **37** — pinned above Flutter's default because `flutter_secure_storage` 11.0.0 (via `crdt_sync_flutter` v0.3.1) publishes AAR metadata demanding API 37+ |
| `minSdk` / `targetSdk` | from Flutter defaults |
| Java / Kotlin | `VERSION_17`; Kotlin plugin `2.3.20` |
| AGP / Gradle | **9.3.2** / **Gradle 9.8.1** (`android/gradle/wrapper/gradle-wrapper.properties`) |
| Release signing | reads `android/key.properties`; **falls back to the debug key** when that file is absent |

`android/local.properties` is **not** in the repository (Flutter generates it, pointing at your
SDK) and `android/key.properties` is **not** in the repository either (CI writes it from
secrets).

**Two Android blockers on this machine:**

1. **API 37 is not installed.** The SDK here has platforms `android-33` and `android-34` and
   build-tools `33.0.1` / `34.0.0`. `compileSdk = 37` will fail.
2. **No device or emulator is connected.** `flutter doctor` lists only Windows, Chrome and
   Edge.

Install the platform with the SDK manager (`sdkmanager "platforms;android-37" "build-tools;37.0.0"`)
and accept the licences (`flutter doctor --android-licenses`) — `flutter doctor -v` currently
reports *"Some Android licenses not accepted"*.

#### 2.5 Environment variables

There is **no `.env` file and no `.env.example`** in this repository. The only environment
variable the tooling reads directly is:

| Variable | Read by | Effect |
|---|---|---|
| `GH_TOKEN` | `tool/sync_smoke.dart:17` | Required by the sync smoke test. Missing → the tool prints `Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token)).` and exits with code **2** |
| `TODO_BROWSER` | `lib/desktop/browser_launcher.dart:34` | Overrides the browser search path. **The only way to point the desktop wrapper at Chrome on Windows** (see 3.4) |
| `HOME` | `bin/todo_desktop.dart:22` | Required by the desktop wrapper. **Unset on Windows by default** → the wrapper exits with code 1 |

```powershell
# Per-session, PowerShell
$env:GH_TOKEN    = "<your GitHub token>"
$env:TODO_BROWSER = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

#### 2.6 Optional: the pre-commit hooks

The repo ships a pre-commit configuration and an installer:

```powershell
# Linux/macOS
bash scripts/install_hooks.sh
```

`scripts/install_hooks.sh` writes the wrapper hook that runs `scripts/bump_patch_version.sh`
**after** pre-commit exits, on purpose — see the long comment in `.pre-commit-config.yaml`.
`AGENTS.md` also documents a hard rule enforced by a hook and by
`.github/workflows/file-length.yml`: **every file must be at most 250 lines**, source and prose
alike. `scripts/check_file_length.sh` is the checker.

#### 2.7 Optional: launcher icons

`pubspec.yaml` configures `flutter_launcher_icons` (Android only, `ios: false`,
`min_sdk_android: 21`). The source art is produced by a shared generator outside this repo:

```bash
PYTHONPATH=~/src/testsAndMisc python3 -m python_pkg.app_icons generate --app <key>
dart run flutter_launcher_icons
```

---

### 3. Launch the Complete Project

#### 3.1 The Android app — the primary mobile target

With a matching Flutter, a connected device and the licences accepted:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\offline-first-note-app-with-sync"
flutter devices
flutter run
```

`lib/main.dart` is bootstrap-only (it is marked `// coverage:ignore-file`): it calls
`installFrameStats()`, opens the platform's note store through `openRepository()` — a
conditional export so the web build never imports `dart:io` — loads `AppSettings`, creates the
`AnalyticsService` and the `ImageStore`, and calls `runApp(TodoApp(...))`.

The landing screen is `CaptureScreen`: a always-focused text box pre-filled with the
structured note template, with lazy note creation on the first keystroke.

**Release APK** (per `AGENTS.md`, always measure smoothness on a release build — debug builds
are janky):

```powershell
flutter build apk --release
```

The CI variant is arm64-only and signed with a real key:

```bash
flutter build apk --release \
  --target-platform android-arm64 \
  --build-name="$SEMVER" \
  --build-number="$COMMIT_COUNT"
```

#### 3.2 The web build

```powershell
flutter config --enable-web
flutter run -d chrome
```

or a production bundle:

```powershell
flutter build web --release
```

The build output lands in `build/web/`. `web/index.html` is the stock Flutter template with
`<title>todo</title>`; `web/manifest.json` is a PWA manifest named `todo`.

#### 3.3 The desktop app — the web build in a Chrome `--app` window

**On Linux (the documented path).** `run.sh` does everything: it detects Arch vs
Debian, installs the missing Flutter and GTK build dependencies with `pacman` / `apt` (it
refuses to run as root), runs `flutter config --enable-web`, `flutter pub get`,
`flutter build web --release`, and finally:

```bash
exec dart run bin/todo_desktop.dart --web-root "${SCRIPT_DIR}/build/web"
```

`run.sh` **will not run on Windows** — `detect_distro` reads `/etc/os-release` and exits with
`error: unsupported distro (expected Arch Linux or Ubuntu/Debian)` on anything else. There is
no `run.ps1` or `run.bat` in the repository.

**The wrapper by hand (any platform that can run Dart):**

```bash
flutter build web --release
dart run bin/todo_desktop.dart --web-root ./build/web
```

It prints:

```
todo desktop serving on http://localhost:8730
```

Useful flags (all read in `bin/todo_desktop.dart`):

| Flag | Effect |
|---|---|
| `--web-root <dir>` | Where the built web assets live. Defaults to `<exe dir>/../web` (the installed layout `/opt/todo/bin/todo-desktop` + `/opt/todo/web`) |
| `--backlog-path <file>` | Override the `BACKLOG.md` path, so a verification run cannot overwrite the real one |
| `--log-path <file>` | Override the notes log path (default `~/.local/share/todo-desktop/todo_notes.json`) |
| `--no-browser` | Serve only; do not launch Chrome |
| `--provision-sync-account` | Headless one-shot: loads the page in headless Chrome for 30 s so the app's own code can write the sync account into the origin-keyed `localStorage`, then exits |

**Why the port and the profile dir are fixed.** `lib/desktop/browser_launcher.dart` and
`lib/sync/desktop_wrapper.dart` both hard-code **8730**, and the profile directory is
`~/.local/share/todo-desktop/profile`. The browser keys the GitHub token (`localStorage`) and
the notes (IndexedDB) **by origin**, so moving either would silently log you out and hide
your notes.

#### 3.4 Running the desktop wrapper on Windows — three separate obstacles

The wrapper is written for Linux. On Windows it hits all three of these:

| Obstacle | Detail | Workaround |
|---|---|---|
| `HOME` is not set | `bin/todo_desktop.dart:22-26` reads `Platform.environment['HOME']` and `exit(1)`s with `HOME is not set; cannot resolve the backlog path.` Verified: `$env:HOME` is empty on this machine | Set it before launching: `$env:HOME = $env:USERPROFILE` |
| No Linux browser is found | `findBrowser()` (`lib/desktop/browser_launcher.dart:33-40`) only probes `/opt/google/chrome/chrome`, `/opt/thorium-browser/thorium-browser`, `/usr/bin/google-chrome-stable`, `/usr/bin/chromium`, `/usr/bin/brave`. On Windows it returns `''` and the wrapper prints `No Chrome-family browser found; open http://localhost:8730 manually.` | Set `$env:TODO_BROWSER = "C:\Program Files\Google\Chrome\Application\chrome.exe"` — Chrome honours `--app=` and `--user-data-dir=` on Windows. `--class=todo` and `--password-store=basic` are Linux-only hints and are simply ignored. Alternatively just open `http://localhost:8730` in Chrome yourself and run the wrapper with `--no-browser` |
| The port guard is Linux-only | `PortGuard` uses `LinuxSystemProbe`, which parses `ss -tlnp` output and reads `/proc/<pid>/cmdline`. On Windows there is no `ss` and no `/proc`, so it cannot identify the port owner. Worse, `bin/todo_desktop.dart:19` hard-codes `const _addressInUse = 98;` — Linux's `EADDRINUSE`. **Windows uses `10048`**, so the "address in use" condition is never detected and the wrapper exits with `could not serve on port 8730: …` | Make sure port 8730 is free before starting (`Get-NetTCPConnection -State Listen -LocalPort 8730`). If the port is taken by a non-todo process, the guard cannot tell and will refuse — kill the other process manually |

#### 3.5 The headless note CLI

```bash
dart run bin/todo_note.dart --text "Title

body" --priority high --status in_progress     # prints the new note id
echo "Title" | dart run bin/todo_note.dart     # text from stdin
dart run bin/todo_note.dart --list             # id, priority, status, title
dart run bin/todo_note.dart --get <id>         # full note
dart run bin/todo_note.dart --set-status <id> done
dart run bin/todo_note.dart --delete <id>
```

`--list` and `--get` never push. `--data-dir <dir>` selects a throwaway node. Exit codes:
**0** ok, **1** sync/auth failure or note not found, **2** bad arguments. All logic is in
`lib/cli/` (tested in `test/cli/`).

The CLI needs a desktop Firebase session at `~/.config/todo/firebase_auth.json`. Seed it with:

```bash
python3 ~/src/utils/crdt-sync/tool/seed_session.py --app todo
```

(That script lives outside this repository — it is not vendored here.)

#### 3.6 Ports

| Component | Port | Address | Source |
|---|---|---|---|
| **Desktop wrapper (fixed)** | **8730** | `http://localhost:8730` | `lib/desktop/browser_launcher.dart:16` (`kWrapperPort`), `lib/sync/desktop_wrapper.dart:8` (`desktopWrapperPort`) |
| Test wrapper origin (unit tests only) | **8731** | `http://localhost:8731` | `lib/sync/desktop_wrapper.dart:17` — a test page on :8731 must not POST its backlog to the real wrapper on :8730 |
| Flutter web dev server (`flutter run -d chrome`) | **8081** | `http://localhost:8081` | Flutter default |
| Android emulator (ADB) | 5555 / 5554 | — | Android default |
| Android app → GitHub / Firebase | outbound 443 | `api.github.com`, `*.firebaseio.com` | — |

**The 8730 port is not configurable.** Change it and the browser sees a different origin, so
the GitHub token and the IndexedDB notes disappear.

---

### 4. Test the Project

> **Nothing in this section that requires the toolchain has been executed.** `flutter pub get`
> fails on the installed Flutter 3.35.2 (2.1), so `flutter test` cannot even start. **No test
> count, pass rate or coverage figure in this document is a result produced here.** Where a
> number appears (for example "494 tests at 100% coverage"), it is quoted from the project's
> own `AGENTS.md` and is labelled as the project's claim.

#### 4.1 The test suite — `flutter test`

`AGENTS.md` gives the project's canonical commands:

| Purpose | Command |
|---|---|
| Full suite | `flutter test --reporter=compact` |
| Suite + coverage | `flutter test --coverage --reporter=compact` |
| Coverage summary | `lcov --list coverage/lcov.info` |
| Static analysis | `flutter analyze` (must be clean before committing) |
| Format | `dart format lib/ test/` |
| Only the tests affected by your change | `scripts/test_changed.sh` |

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\offline-first-note-app-with-sync"
flutter test --reporter=compact
```

**The project's own claim** (`AGENTS.md`, "Testing" section): *"It is currently **494 tests at
100% line coverage** (2870 lines), ~40s on this machine with `--concurrency=3`"*, and *"check
the last line says 'All tests passed'"*. **This has not been verified here.**

`AGENTS.md` also warns that unbounded concurrency under a 4 GiB cap gets the test processes
SIGTERMed while the wrapper still exits 0 — so **check the final line, not just the exit
code**:

```powershell
flutter test --reporter=compact --concurrency=3
```

**What the suite covers** — 86 Dart test files under `test/`:

| Area | Example files |
|---|---|
| Data / CRDT | `note_repository_crud_test.dart`, `note_repository_filters_test.dart`, `note_repository_streams_test.dart`, `note_repository_migration_test.dart` (v1→v2→v3 schema migrations) |
| Note model & template | `note_test.dart`, `note_template_test.dart` |
| Sync | `sync_service_test.dart`, `sync_service_revision_test.dart`, `sync_settings_test.dart`, `run_sync_test.dart`, `github_mirror_device_flow_test.dart` |
| Firebase backend | `firebase_backend_test.dart`, `google_sign_in_backend_test.dart` |
| UI (widget) | `capture_screen_*_test.dart` (×4), `notes_list_screen_test.dart`, `notes_list_filter_test.dart`, `note_editor_guided_test.dart`, `note_editor_modes_test.dart`, `note_editor_wizard_test.dart`, `note_detail_screen_test.dart`, `settings_screen_test.dart`, `settings_screen_backup_test.dart` |
| Images / attachments | `attachment_ingest_test.dart`, `image_processing_test.dart`, `image_cache_store_test.dart`, `dufs_image_client_test.dart`, `attachment_picking_test.dart` |
| Desktop wrapper | `wrapper_server_static_test.dart`, `wrapper_server_provisioning_test.dart`, `wrapper_attach_route_test.dart`, `wrapper_image_routes_test.dart`, `wrapper_attachment_serving_test.dart` |
| Port guard | `port_guard_parse_test.dart`, `port_guard_resolve_test.dart`, `port_guard_linux_probe_test.dart` |
| CLI | `cli/cli_args_test.dart`, `cli/cli_runner_test.dart`, `cli/cli_session_test.dart`, `cli/cli_read_input_test.dart` |
| Misc | `theme_test.dart`, `analytics_*_test.dart`, `local_backup_test.dart`, `notes_markdown_test.dart`, `markdown_view_test.dart`, `app_settings_test.dart` |

**Widget tests use fakes, never a real database.** `test/fake_note_repository.dart` provides a
`FakeNoteRepository` built on `StreamController`s, because a real `sqlite_crdt` DB schedules
timers that never drain under the widget tester's fake clock ("A Timer is still pending").
HTTP is faked with `MockClient` (`package:http/testing.dart`); the file picker and URL
launcher are faked through their **platform interfaces**
(`file_selector_platform_interface`, `url_launcher_platform_interface`) with
`MockPlatformInterfaceMixin`.

#### 4.2 The sync smoke test — needs a real GitHub token

```powershell
$env:GH_TOKEN = "<your GitHub token>"
dart run tool/sync_smoke.dart
```

`tool/sync_smoke.dart` is a headless end-to-end proof against the **real** `kuhyx/syncs`
repository. It simulates two devices (A and B), each creates a note offline, then syncs them
through the repo and asserts both devices converge to both notes. It then deletes its
throwaway changeset files from `todo-sync/notes_smoketest/`.

- Without `GH_TOKEN` it prints `Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token)).` and exits
  with code **2** (verified by reading `tool/sync_smoke.dart:17-21`).
- On success it prints `✅ PASS: both devices converged to both notes via GitHub.` and exits
  **0**.
- On failure it prints `❌ FAIL: devices did not converge. Expected …` and exits **1**.

> This test **writes to a real private GitHub repository** and needs a token with write
> access to it. It is not a read-only check.

#### 4.3 Static analysis

```powershell
flutter analyze
```

`analysis_options.yaml` includes `package:very_good_analysis/analysis_options.yaml` and
turns several lints into **errors** (`missing_required_param`, `unnecessary_null_comparison`,
`dead_code`, `invalid_annotation_target`), plus `strict-casts`, `strict-inference` and
`strict-raw-types`. It also enables `public_member_api_docs`, `lines_longer_than_80_chars`,
`avoid_print`, `cancel_subscriptions`, `close_sinks` and `unawaited_futures`. `test/**`,
`android/**`, `web/**` and the other platform folders are **excluded** from analysis.

#### 4.4 The desktop wrapper over HTTP

Start the wrapper and then poke it. The wrapper serves the web bundle, the `/backup/*`
routes and the `/images/*` routes.

> **curl quote-mangling on Windows.** `curl.exe` is a native binary and PowerShell's argument
> parser strips double quotes before the process sees them, so an inline
> `-d "{\"a\":\"b\"}"` arrives malformed. Write the body to a file first and use
> `--data-binary "@file"` — **the `@` and the quotes around the file name are both required**
> (curl's "read the body from this file" syntax):
>
> ```powershell
> $body = '{"text":"hello"}'
> $body | Set-Content -LiteralPath "$env:TEMP\todo_body.json" -Encoding utf8
> curl.exe -s -X POST -H "Content-Type: application/json" --data-binary "@$env:TEMP\todo_body.json" "http://localhost:8730/backup"
> ```
>
> `Invoke-RestMethod` is the PowerShell-native alternative and needs no escaping at all:
>
> ```powershell
> Invoke-RestMethod -Method Post -Uri "http://localhost:8730/backup" -ContentType "application/json" -Body (@{ text = "hello" } | ConvertTo-Json)
> ```

Check the wrapper is up:

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:8730/"
```

A `200` means the web bundle is being served.

#### 4.5 The sync path, end to end in the app

1. Launch the app (Android device or the desktop wrapper).
2. **Settings → Connect GitHub.** The app uses the OAuth device flow
   (`github_device_auth`) or `google_sign_in` to mint a token, which is then stored in
   `flutter_secure_storage` (Android) / origin-keyed `localStorage` (web).
3. **Settings → Test connection.**
4. Type a note on device A; it is persisted on every keystroke, offline.
5. Sync; the note is written to `todo-sync/changesets/<nodeId>.json` in the GitHub repo.
6. On device B, sync; B pulls A's changeset and merges it (the CRDT layer is commutative
   and idempotent, so **no two devices ever write the same file** and there are no git merge
   conflicts).

**Every device owns exactly one file** in the repo: `todo-sync/changesets/<nodeId>.json`,
holding that device's full CRDT changeset.

#### 4.6 The headless CLI

```powershell
$env:GH_TOKEN = "<your GitHub token>"
dart run bin/todo_note.dart --list
dart run bin/todo_note.dart --text "a note from the CLI" --priority high --status in_progress
dart run bin/todo_note.dart --get <id>
dart run bin/todo_note.dart --delete <id>
```

`--list` and `--get` never push. Exit code **2** means bad arguments.

#### 4.7 Other tools

| Tool | What it does |
|---|---|
| `tool/sync_smoke.dart` | The two-device convergence proof (4.2) |
| `tool/device_flow_check.dart` | Exercises the GitHub device-flow auth |
| `tool/image_e2e_wrapper.dart` | End-to-end check of the wrapper's image routes |
| `tool/migrate_backlog.dart` | Converts an old `BACKLOG.md` export to the current format (Settings → Export → migrate → Settings → Import) |
| `scripts/test_changed.sh` | Runs only the tests mapped to your changed files |
| `scripts/check_file_length.sh` | The 250-line gate |
| `scripts/check_repo_contract.sh`, `check_md_naming.sh`, `check_home_paths.sh`, `check_no_crdt_sync_override.sh`, `check_dependency_freshness.sh` | Repo-contract checks mirrored by the GitHub workflows |

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `The current Dart SDK version is 3.9.0.` / `Because todo requires SDK version ^3.12.2, version solving failed.` / `Failed to update packages.` | **The #1 blocker.** Flutter 3.35.2 / Dart 3.9.0 is installed; the project needs Dart ≥ 3.13.0 (Flutter ≥ 3.44.0), `.fvmrc` pins 3.47.7 | Install Flutter 3.47.7 (via FVM or directly) — see 2.1. Do **not** lower the SDK constraint |
| `fvm: The term 'fvm' is not recognized` | FVM is not installed on this machine | `dart pub global activate fvm`, then `fvm install 3.47.7` / `fvm use 3.47.7` |
| `Could not resolve package crdt_sync` / `design_system` / `github_device_auth` / `sync_settings_ui` | The four git-hosted dependencies could not be fetched from `github.com/kuhyx/utils` | Check network access and git credentials. These are **private or unlisted** repos — you need access to `github.com/kuhyx/utils` |
| `flutter test` fails immediately with the same SDK message | `pub get` never completed | Fix the SDK version first |
| `Failed to find target with hash 'android-arm64'` / `compileSdk 37` errors | Android platform 37 is not installed here (only `android-33` and `android-34`) | `sdkmanager "platforms;android-37" "build-tools;37.0.0"` |
| `Some Android licenses not accepted` | Licence prompts were never accepted | `flutter doctor --android-licenses` |
| `flutter run` says no device is available | No Android device or emulator is connected | Start an emulator, or `adb devices` to check a physical device |
| `HOME is not set; cannot resolve the backlog path.` | `bin/todo_desktop.dart` requires `HOME`; it is unset on Windows | `$env:HOME = $env:USERPROFILE` |
| `No Chrome-family browser found; open http://localhost:8730 manually.` | `findBrowser()` only probes Linux paths | Set `$env:TODO_BROWSER` to the Windows Chrome path, or open `http://localhost:8730` yourself and run the wrapper with `--no-browser` |
| `could not serve on port 8730: …` | The hard-coded `_addressInUse = 98` is Linux's `EADDRINUSE`; **Windows uses `10048`**, so the wrapper cannot recognise a busy port | Free port 8730 first: `Get-NetTCPConnection -State Listen -LocalPort 8730` |
| The wrapper refuses to start because the port is held | `PortGuard` uses `ss -tlnp` and `/proc`, which do not exist on Windows, so it cannot tell a stale todo wrapper from an unrelated process | Kill the other process manually; the guard cannot do it for you on Windows |
| Your notes and GitHub token "disappeared" | The port or the Chrome profile dir changed — `localStorage` and IndexedDB are keyed by origin | Restore port **8730** and profile `~/.local/share/todo-desktop/profile`. **Do not change either.** |
| `Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token)).` then exit code 2 | `tool/sync_smoke.dart` needs `GH_TOKEN` | `$env:GH_TOKEN = "<token>"` — and remember it needs **write** access to `kuhyx/syncs` |
| `todo needs this exact port — its notes and GitHub token are stored per origin.` | The port guard gave up on a port it could not attribute | Free port 8730 |
| `unrecognized command: "flutter"` / `command not found: flutter` inside `run.sh` | `run.sh` is Linux-only and only installs Flutter on Arch/Debian | Run the wrapper by hand: `flutter build web --release` then `dart run bin/todo_desktop.dart --web-root ./build/web` |
| `error: unsupported distro (expected Arch Linux or Ubuntu/Debian)` | `run.sh` on Windows | Same as above — do not use `run.sh` |
| `install_arch.sh` / `packaging/aur/PKGBUILD` do nothing useful here | Both target Arch Linux | Ignore them on Windows; they are for the AUR package `todo-flutter` |
| `A Timer is still pending` in a widget test | A real `sqlite_crdt` DB schedules timers that never drain under the widget tester's fake clock | Use `FakeNoteRepository` from `test/fake_note_repository.dart`, as the existing tests do |
| `pumpAndSettle` never settles | An autofocused `TextField` cursor blink and the device-code dialog's poll timer never settle | Use explicit `pump(Duration)` instead, as `AGENTS.md` advises |
| Coverage report is empty | `flutter test --coverage` was not run, or `lcov` is missing | `flutter test --coverage --reporter=compact`, then `lcov --list coverage/lcov.info` |

**Known limitations to state honestly**

* **The project cannot be built or tested with the toolchain installed on this machine.**
  Flutter 3.35.2 / Dart 3.9.0 fails `pub get` against `sdk: ^3.12.2`. FVM is not installed.
  **No test result, coverage figure or build output in this document was produced here.**
* **The "494 tests at 100% coverage" figure is the project's own claim** from `AGENTS.md`,
  not a measurement taken during this setup. Treat it as a baseline to check *after* you get
  a matching SDK.
* **There is no CI job that runs the tests.** `.github/workflows/` contains
  `dependency-freshness.yml`, `file-length.yml`, `md-naming.yml`, `release-apk.yml` and
  `repo-contract.yml` — **no `flutter test` and no `flutter analyze` job**.
  `release-apk.yml` says so explicitly: *"This job is NOT gated on a test suite: this repo
  has no Flutter analyze/test job to depend on, so a broken commit still publishes."* The
  only backstop is the build failing.
* **There is no iOS target.** `ios/` is not in the repository; `.metadata` lists only `root`
  and `web`. iOS work would mean `flutter create --platforms ios` first.
* **The desktop app is the web build.** There is no native desktop shell — Flutter's Linux
  embedder was removed on purpose (20 fps at 4K vs 144 fps in Chrome).
* **The desktop path is Linux-first and needs patching on Windows** — three separate issues
  (`HOME`, the browser search path, the `EADDRINUSE` errno) plus the `/proc`-based port
  guard. See 3.4.
* **Attachments are references, not bytes.** A note stores a URL
  (`https://kuhy-cloud.duckdns.org/todo-images/<noteId>/<uuid>.<ext>`), never the file
  itself, so sync and older builds are unaffected. That means the image host is a hard
  external dependency for image attachments.
* **The desktop page never talks to dufs directly** — the wrapper's `/images/*` routes do,
  using `~/.config/dufs/logins/todo.env`, which is created by a script **outside this
  repository** (`~/src/dufs-cloud/scripts/add_dufs_login.sh`).
* **The token is stored in `localStorage` on the web** and in the OS keystore on Android.
  The desktop page therefore keeps a GitHub token in a browser profile on disk.
* **`sync_smoke.dart` writes to a real private repository** and needs a write-scoped token.
  It is not a read-only check.
* **The project requires access to a third-party repository** (`github.com/kuhyx/utils`) for
  four of its dependencies, pinned to four different branches. Without access to that repo,
  `pub get` cannot succeed no matter how new the SDK is.
* **Android release signing falls back to the debug key** when `android/key.properties` is
  absent — so a locally built "release" APK is **debug-signed** and cannot be installed over
  a CI-signed build. The CI job explicitly checks this with `apksigner`.
* **The release APK is arm64-only** by design (a personal single-device sideload
  distribution), so it will not run on an x86 emulator.
* **`project-metadata.json` is wrong about "Firestore."** There is no Firestore client in
  the code; sync is over a GitHub repository, with Firebase Realtime Database used for the
  headless CLI session and analytics flushing.
* **The repository's git workflow is unusual and explicitly documented in `AGENTS.md`**:
  *"Never open pull requests. Always commit and work directly on `main` and `git push` to
  `origin/main`."* Do not create feature branches.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Environment**

- [ ] `flutter --version` reports **Flutter 3.47.7** (or ≥ 3.44.0) with **Dart ≥ 3.13.0**
- [ ] `fvm --version` works, **or** you have installed a matching Flutter manually
- [ ] `fvm use 3.47.7` / your Flutter matches `.fvmrc`
- [ ] `flutter doctor -v` shows no blocking issue for your target (Android toolchain OK,
      licences accepted)
- [ ] Android platform **37** and matching build-tools are installed
- [ ] A device or emulator shows up in `flutter devices`
- [ ] You have access to `github.com/kuhyx/utils` for the four git-hosted dependencies

**Dependencies**

- [ ] `flutter pub get` completes with **no** "version solving failed" message
- [ ] `.dart_tool/package_config.json` now exists
- [ ] `pubspec.lock` was **not** modified (the checked-in lockfile is the source of truth)
- [ ] All four git packages resolved: `crdt_sync`, `design_system`, `github_device_auth`,
      `sync_settings_ui`

**Static checks**

- [ ] `flutter analyze` completes with no issues and no errors
- [ ] `dart format --output=none --set-exit-if-changed lib/ test/` reports no changes
- [ ] `bash scripts/check_file_length.sh` passes (every file ≤ 250 lines)

**Tests**

- [ ] `flutter test --reporter=compact --concurrency=3` runs
- [ ] The **last line** of the output says `All tests passed` (do not rely on the exit code
      alone — `AGENTS.md` warns about SIGTERMed workers)
- [ ] The test count matches the project's stated baseline (claimed as **494** in
      `AGENTS.md`) — record the number you actually observe
- [ ] `flutter test --coverage --reporter=compact` produces `coverage/lcov.info`
- [ ] `lcov --list coverage/lcov.info` shows the coverage summary
- [ ] `test/fake_note_repository.dart` is used by the widget tests (no real DB in widget tests)

**App — Android**

- [ ] `flutter run` installs and launches on a connected device
- [ ] The capture screen opens with the text box focused and the note template pre-filled
- [ ] Typing persists the note on every keystroke
- [ ] The notes list shows the note; filter and sort work
- [ ] `flutter build apk --release` succeeds (remember: it is debug-signed unless you supply
      `android/key.properties`)
- [ ] You have noted that the CI APK is arm64-only

**App — desktop / web**

- [ ] `flutter build web --release` produces `build/web/`
- [ ] The wrapper prints `todo desktop serving on http://localhost:8730`
- [ ] `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:8730/"` returns `200`
- [ ] The app opens in a Chrome `--app` window using the fixed profile directory
- [ ] On Windows you have set `$env:HOME` and `$env:TODO_BROWSER`, and port 8730 was free
- [ ] Your notes and GitHub token survived a restart — i.e. the port and the profile dir are
      unchanged

**Sync**

- [ ] Settings → Connect GitHub succeeds and the token is stored in the keystore /
      `localStorage`
- [ ] A note created on device A appears on device B after a sync
- [ ] `dart run tool/sync_smoke.dart` with `GH_TOKEN` set prints
      `✅ PASS: both devices converged to both notes via GitHub.` and exits 0
- [ ] The throwaway `todo-sync/notes_smoketest/` files were cleaned up afterwards
- [ ] The headless CLI lists, adds, reads and deletes notes with the documented exit codes

**CI / release (optional)**

- [ ] `.github/workflows/release-apk.yml` publishes a prerelease for your commit
- [ ] `apksigner verify --print-certs` on the published APK shows the `kuhy` certificate and
      **not** `CN=Android Debug`
- [ ] You have read `AGENTS.md` and are committing directly to `main`, not opening a pull
      request

**Cleanup**

- [ ] `Get-NetTCPConnection -State Listen -LocalPort 8730,8081 -ErrorAction SilentlyContinue`
      shows nothing unexpected still bound
- [ ] No `GH_TOKEN` is left in a persistent environment variable
- [ ] `git status` shows only the files you meant to change — `pubspec.lock` in particular

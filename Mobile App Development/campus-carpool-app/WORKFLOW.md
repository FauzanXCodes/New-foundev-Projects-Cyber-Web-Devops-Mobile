# College Carpool (campus-carpool-app) — Setup & Test Workflow

This is a **real Flutter mobile app** (Dart, `flutter` package name `myapp1`, `MaterialApp` title `College Carpool`). It lets a student register, fill in a profile, post campus rides with a seat count, browse an in-memory ride board, and drop parking pins on an OpenStreetMap map. All persistence is local via `shared_preferences`; there is no backend, no Firebase, and no Google Maps SDK. **Scope note, and the headline caveat:** the project currently **cannot be resolved, analyzed, built, or run** on this machine. `pubspec.yaml` requires Dart `^3.10.1`, the installed Flutter is 3.35.2 (Dart 3.9.0), and `flutter pub get` fails at version solving before a single package is downloaded. Every command below is therefore either a *blocked* step (marked as such) or a step whose expected result is derived from reading the source. Nothing in this document claims the app was launched or that its tests were run.

### 1. Prerequisites

| Requirement | Version / value | Verified on this machine (2026-10-22) | Notes |
| --- | --- | --- | --- |
| Flutter SDK | must ship Dart `>=3.10.1`; pub's own suggestion is **Flutter `3.47.7`** | **Flutter 3.35.2 / Dart 3.9.0** at `C:\Users\fauzan\Downloads\flutter_windows_3.35.2-stable\flutter\bin\flutter.bat` | **BLOCKER.** See §2.2 |
| Dart SDK | bundled with Flutter | `3.9.0` (DevTools 2.48.0), `windows_x64` | Ships with Flutter; cannot be upgraded independently |
| Git | any recent version | `2.51.2.windows.1` present | Only to clone/update |
| Android SDK | platform 34 detected; `flutter doctor` reports Android SDK version `34.0.0` | present, but **"Some Android licenses not accepted"** | Run `flutter doctor --android-licenses` |
| JDK 17 | `JAVA_HOME=C:\Users\fauzan\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.8.101-hotspot` | present | `android/app/build.gradle.kts:13-20` sets Java/Kotlin 17 |
| Xcode | for iOS and macOS | **unavailable on Windows** | macOS host required |
| Visual Studio 2022 | "Desktop development with C++" workload, for the `windows/` target | **NOT installed** (`flutter doctor`: "Visual Studio not installed; this is necessary to develop Windows apps") | Blocks `flutter run -d windows` |
| Linux desktop deps | GTK dev headers, `ninja-build`, `clang`, `pkg-config` | n/a (Windows host) | Blocks `flutter run -d linux` |
| Chrome | for the `web/` target | present | `flutter doctor`: OK |

Working directory for every command below:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\campus-carpool-app"
```

### 2. Installation and Setup

#### 2.1 Repository state as shipped

| Item | Status | Notes |
| --- | --- | --- |
| `pubspec.yaml` | present | `name: myapp1`, `version: 1.0.0+1`, `environment.sdk: ^3.10.1` |
| `pubspec.lock` | present | 13 KB; resolved for `dart: ">=3.10.1 <4.0.0"`, `flutter: ">=3.35.0"` |
| `.dart_tool/` | **absent** | Packages are unresolved; no `package_config.json` exists |
| `lib/` | 13 Dart files, ~1,820 lines | 1 entry point, 8 screens, 2 services, 2 models |
| `test/` | 1 file | `test/widget_test.dart` |
| Platform folders | `android`, `ios`, `linux`, `macos`, `web`, `windows` | all six are present and tracked (141 tracked files) |
| `project-metadata.json` | **untracked** (`git status` shows `?? project-metadata.json`) | Added by tooling, not part of the upstream repo. Its claims are contradicted by the code — see §5.1 |

Declared dependencies (`pubspec.yaml`):

| Package | Constraint | Purpose |
| --- | --- | --- |
| `flutter` | sdk | framework |
| `flutter_map` | `^7.0.0` | OpenStreetMap map widget |
| `latlong2` | `^0.9.0` | `LatLng` value type used with `flutter_map` |
| `shared_preferences` | `^2.2.2` | the only persistence layer |
| `cupertino_icons` | `^1.0.8` | icons |
| `flutter_test` | sdk (dev) | test framework |
| `flutter_lints` | `^6.0.0` (dev) | lint rules, wired in via `analysis_options.yaml` |

#### 2.2 The blocker: `flutter pub get` fails

```powershell
flutter pub get
```

Observed on this machine (the command was run in `--dry-run` mode so nothing was written):

```
Resolving dependencies...
The current Dart SDK version is 3.9.0.

Because myapp1 requires SDK version ^3.10.1, version solving failed.

You can try the following suggestion to make the pubspec resolve:
* Try using the Flutter SDK version: 3.47.7.

Failed to update packages.
```

Exit code `1`. No `.dart_tool/` directory is created and `pubspec.lock` is left untouched (confirmed with `git status --porcelain`, which shows only the pre-existing untracked `project-metadata.json`).

The constraint is declared in `pubspec.yaml:7-8`:

```yaml
environment:
  sdk: ^3.10.1
```

`^3.10.1` means `>=3.10.1 <4.0.0`. The installed Dart is 3.9.0, so no version of the current SDK can satisfy it. `pubspec.lock` was resolved on a machine with a newer SDK, which is why the lock file and the local toolchain disagree.

**This blocks every downstream Flutter command** — `flutter pub get`, `flutter run`, `flutter test`, `flutter build`, and `flutter analyze` (see §4.2) all fail at the same resolution step.

#### 2.3 Fixing the blocker (required)

Install a Flutter SDK that ships **Dart 3.10.1 or newer**. Pub's own suggestion is **Flutter 3.47.7**; any stable release newer than that also satisfies the constraint. Options:

```powershell
# Option A - download the stable Windows zip from https://docs.flutter.dev/install/release
#            (pick a release whose bundled Dart is >= 3.10.1), then point PATH at its bin folder.

# Option B - if you already have a newer Flutter elsewhere on disk:
& "C:\path\to\newer\flutter\bin\flutter.exe" --version   # confirm "Tools • Dart 3.10.x" or newer

# Option C - FVM / Chocolatey / Scoop, if you prefer a version manager:
scoop install flutter   # then: scoop pin flutter 3.47.7
```

Then re-verify:

```powershell
flutter --version
```

Expected: `Tools • Dart 3.10.1` or higher. **Do not edit `pubspec.yaml` to relax the SDK constraint** — that would silently change the project's declared minimum and desynchronise it from `pubspec.lock`.

#### 2.4 Resolve dependencies (after §2.3)

```powershell
flutter pub get
```

Expected on success: a `.dart_tool/` directory with `package_config.json`, and `pubspec.lock` unchanged (it is already resolved for the newer SDK). If pub reports that it changed the lock file, that means the lock file was generated against different package versions than the current `pubspec.yaml` — review the diff before keeping it.

#### 2.5 Platform-specific setup

- **Android**: `flutter doctor --android-licenses` to accept the outstanding licences. `android/app/build.gradle.kts` uses `flutter.compileSdkVersion`, `flutter.minSdkVersion`, `flutter.targetSdkVersion` and `flutter.ndkVersion` (resolved from the SDK), `applicationId = "com.example.myapp1"` (a placeholder — the file still carries the upstream "TODO: Specify your own unique Application ID" comment), and signs release builds with the **debug** key.
- **iOS**: `ios/Runner.xcodeproj` is present with `PRODUCT_BUNDLE_IDENTIFIER = com.example.myapp1` (also a placeholder). Requires macOS + Xcode; `ios/RunnerTests/` contains the default template test target.
- **Windows desktop**: requires Visual Studio 2022 with the "Desktop development with C++" workload. Not installed here.
- **Linux desktop**: requires a Linux host with GTK development packages.
- **Web**: `web/index.html` and `web/manifest.json` are still the Flutter template defaults — `<title>myapp1</title>` and `<meta name="description" content="A new Flutter project.">`. The web build therefore ships with the placeholder title, not "College Carpool".

### 3. Launch the Complete Project

#### 3.1 Entry point and app identity

- Entry point: `lib/main.dart` → `void main()` → `runApp(const CollegeCarpoolApp())`.
- `CollegeCarpoolApp` (`lib/main.dart:13-33`) is a `StatelessWidget` returning a `MaterialApp` with `title: 'College Carpool'`, `debugShowCheckedModeBanner: false`, Material 3 theme seeded from `Colors.indigo`, `scaffoldBackgroundColor: Color(0xFFF7F7F7)`, `fontFamily: 'Roboto'`, and `home: const LoginScreen()`.
- `MainShell` (`lib/main.dart:35-122`) is the signed-in shell: a `Drawer` with a `UserAccountsDrawerHeader` and a Profile tile, plus a `NavigationBar` with three destinations — **Profile** (`ProfileFormScreen`), **Rides** (`RideBoardScreen`), **Parking** (`ParkingScreen`).
- `LoginScreen` pushes `MainShell` when `ProfileStorage.isProfileCompleted()` is true, otherwise `ProfileFormScreen` (`lib/screens/login_screen.dart:44-53`).
- The map widgets use `flutter_map` with `urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'` — **no API key is required**. The hard-coded campus centre is `LatLng(18.9434, 72.8338)` (`lib/screens/campus_map_screen.dart:11`), with nearby pickup markers at `18.9439, 72.8342` and `18.9429, 72.8334`.

#### 3.2 Ports summary

Flutter does not use fixed application ports; there is no HTTP server in this app.

| Port | Purpose | Source of truth |
| --- | --- | --- |
| random (Flutter-chosen) | `flutter run -d chrome` web dev server | pin it with `flutter run -d chrome --web-port 8080` |
| `8081` | the legacy Flutter dev-server port | **not used** by this project |
| `5037` / `5555` | adb / Android emulator | only when an emulator or device is attached |
| n/a | Windows, Linux, macOS desktop targets | native window, no port |

#### 3.3 Run on the web (lowest-friction target on this machine)

```powershell
flutter run -d chrome
```

Requires §2.3 and §2.4 to have succeeded first. `flutter doctor` reports Chrome as available.

#### 3.4 Run on Android

```powershell
flutter devices          # confirm a device or emulator is attached
flutter run -d <device-id>
```

`flutter doctor` reports "Connected device (3 available)" on this machine, but the Android licences are not accepted, which blocks Gradle builds.

#### 3.5 Run on Windows desktop (blocked)

```powershell
flutter run -d windows
```

This will fail: Visual Studio is not installed and the "Desktop development with C++" workload is required. Install Visual Studio 2022 with that workload, then re-run `flutter doctor`.

#### 3.6 Run on iOS / macOS (blocked on this host)

```powershell
flutter run -d ios
flutter run -d macos
```

Both require macOS with Xcode. `flutter run -d macos` will not work on Windows.

#### 3.7 Release builds

```powershell
flutter build apk --release        # Android APK (debug-signed by the current Gradle config)
flutter build appbundle --release  # Android App Bundle
flutter build ipa --release        # iOS — macOS only
flutter build web                  # static web bundle in build/web
flutter build windows              # Windows desktop — blocked by the missing Visual Studio
```

Note that the Android release build is signed with the **debug** key (`android/app/build.gradle.kts:33-39`), so the APK is not distributable as-is.

### 4. Test the Project

#### 4.1 Unit / widget test

```powershell
flutter test
```

There is exactly one test file, `test/widget_test.dart`, containing one `testWidgets` case:

```dart
await tester.pumpWidget(const CollegeCarpoolApp());
expect(find.byType(MaterialApp), findsOneWidget);
```

**I did not run it.** Reading the source, this test is expected to pass once dependencies resolve, because:

- `CollegeCarpoolApp` builds a plain `MaterialApp` with `home: const LoginScreen()`.
- `LoginScreen` is a `StatefulWidget` whose `initState` does nothing; the only `SharedPreferences` access (`ProfileStorage.isProfileCompleted()`) happens inside `_login()`, which the test never triggers. So no `SharedPreferences.setMockInitialValues(...)` setup is required for this specific test.
- No network or map tile fetch is triggered by the initial frame.

Command variants once the SDK is fixed:

```powershell
flutter test --reporter expanded
flutter test --coverage        # writes coverage/ (gitignored)
```

#### 4.2 Static analysis — and the "Target of URI doesn't exist" trap

```powershell
flutter analyze
```

**Currently blocked.** On this machine the command does not reach the analyzer at all: it starts with `Resolving dependencies...`, hits the same Dart SDK version failure as §2.2, and exits `1`. `flutter analyze` runs an implicit `pub get` first, so it inherits the §2.2 blocker.

The "Target of URI doesn't exist" symptom appears in the closely-related situation where the analyzer runs without a *successful* dependency resolution — for example when `.dart_tool/package_config.json` exists but the packages themselves are missing or were resolved against a different SDK. The analyzer then cannot map `package:flutter_map/flutter_map.dart`, `package:latlong2/latlong2.dart`, or `package:shared_preferences/shared_preferences.dart` to real files, and reports errors such as:

```
error - lib/screens/campus_map_screen.dart:2:8 - Target of URI doesn't exist: 'package:flutter_map/flutter_map.dart'. ... - uri_does_not_exist
error - lib/main.dart:1:27 - The name 'LatLng' isn't a class. ... - creation_with_non_type
```

These are **spurious** — they are resolution artefacts, not real defects in the code. The fix is always to run `flutter pub get` successfully (§2.4), never to edit the imports.

To reproduce this class of failure in isolation (verified on this machine with a scratch project in a temp directory, not in this repo): a Dart package whose `pubspec.yaml` is valid but which has no `.dart_tool/package_config.json` produces exactly `Target of URI doesn't exist: 'package:shared_preferences/shared_preferences.dart'` from `dart analyze`.

`analysis_options.yaml` includes `package:flutter_lints/flutter.yaml` and adds no extra rules, so the lint baseline is the stock `flutter_lints` set.

#### 4.3 Build verification

```powershell
flutter build web         # proves the Dart code compiles and bundles
flutter build apk         # proves the Android target compiles (needs accepted licences)
```

A successful `flutter build web` is the cheapest end-to-end proof that the SDK constraint was resolved correctly and that the whole `lib/` tree compiles.

#### 4.4 Manual smoke test

Run `flutter run -d chrome` (or on a device) and walk the flows that the source actually implements:

| Step | Expected behaviour (from source) |
| --- | --- |
| Launch | `MaterialApp` with title `College Carpool` opens directly on `LoginScreen` (AppBar "Login", heading "Welcome back", Username + Password fields, "Login" button, "Don't have an account? Register") |
| Log in with any non-empty username and password | `LoginScreen._login()` currently accepts **any** non-empty credentials — line 33 is a `TODO: replace with real AuthStorage.loginUser when ready`. It then routes to `ProfileFormScreen` (first run) or `MainShell` (profile already complete) |
| Register | `RegisterScreen` calls `AuthStorage.registerUser(username, password)`, which stores the account in `shared_preferences` under the key `users_list` as a JSON list and rejects duplicate usernames. Passwords are stored in **plain text** |
| Fill in the profile | `ProfileFormScreen` collects name, roll number, department, phone and vehicle (type / model / plate number); `ProfileStorage.saveProfile` writes `user_profile` (JSON) and sets `profile_completed = true` |
| Rides tab | `RideBoardScreen` shows an empty-state card ("No rides yet.\nTap the + button to post a ride."), a FAB, a "Post ride" form (from, to, date, time, seats, note) and a "My rides" action. `seats` defaults to `1` when the field is not a valid integer. Rides live in an **in-memory** `List<Ride>` and are lost on restart |
| My rides | `MyRidesScreen` filters the in-memory list; each ride shows from → to, date, time, "Seats: N", and the note |
| Parking tab | `ParkingScreen` offers a map-picker flow (`ParkingMapPickerScreen`) and renders parking spots as markers on an OpenStreetMap tile layer |
| Map tiles | Requests go to `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; an offline device shows a blank map, and OSM's public tile policy expects a real User-Agent on high-volume use |

**There is no in-app chat, no route matching, no seat booking/claiming, and no push notification** in this codebase. Do not look for them.

### 5. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `The current Dart SDK version is 3.9.0. Because myapp1 requires SDK version ^3.10.1, version solving failed.` | Flutter SDK is older than the `pubspec.yaml` SDK constraint | Install Flutter `3.47.7` or newer (§2.3); do not edit the constraint |
| `Try using the Flutter SDK version: 3.47.7` | Pub's own resolution hint | Same as above |
| `Target of URI doesn't exist: 'package:flutter_map/flutter_map.dart'` (and similar for `latlong2`, `shared_preferences`) | The analyzer ran without a successful `pub get` | Run `flutter pub get` (§2.4). These are spurious errors, not code defects |
| `flutter analyze` stops at `Resolving dependencies...` | `flutter analyze` performs an implicit `pub get` first | Fix the SDK version; then re-run |
| `flutter run` exits with `Could not find a command named "pub"` / SDK errors | `PATH` still resolves to the old Flutter | `flutter --version` and fix `PATH` ordering |
| `flutter pub get` succeeds but `flutter run` reports "No pubspec.lock file found" or version conflicts | `pubspec.lock` was resolved for a different SDK | `flutter pub get` after the upgrade; review any lock-file diff |
| Gradle fails with `Failed to install the following Android SDK packages` / licence errors | Android licences not accepted | `flutter doctor --android-licenses` |
| Gradle fails on Java version | Wrong JDK on `PATH` | `JAVA_HOME` must point to JDK 17 (`android/app/build.gradle.kts` targets Java 17) |
| `Visual Studio not installed; this is necessary to develop Windows apps` | Missing VS 2022 C++ workload | Install it, or use the web/Android target instead |
| `flutter run -d ios` reports no device | iOS requires macOS + Xcode | Use web/Android, or build on a macOS host |
| The map renders blank | No internet access to `tile.openstreetmap.org`, or tiles blocked | Check network egress; the map has no offline tile cache |
| `flutter test` fails with a plugin `MissingPluginException` | A future test touches `shared_preferences` | Call `SharedPreferences.setMockInitialValues({})` in `setUp`; the current single test does not need it |
| App opens on a blank/white screen on web | `web/index.html` still carries the Flutter template title and description | Cosmetic only; the template title is `myapp1` |

#### 5.1 Known limitations to state honestly

- **`flutter pub get` fails and nothing in this project can be built or run on this machine.** Flutter 3.35.2 ships Dart 3.9.0; `pubspec.yaml` requires `^3.10.1`. Pub's suggested fix is Flutter `3.47.7`. This is the primary blocker and it must be cleared before any of §3 or §4 can produce a result.
- **`.dart_tool/` does not exist and the packages are unresolved.** `pubspec.lock` is present but was generated against a newer SDK.
- **`flutter analyze` cannot currently reach the analyzer**, so the code has not been linted or type-checked in this checkout. There is no verified baseline of analyzer diagnostics.
- **The widget test was not executed.** Its expected-pass reasoning in §4.1 is derived from the source, not from a run.
- **`project-metadata.json` misdescribes this project.** It claims stack `Flutter; Google Maps; Firebase` and a goal of "Post rides, seat availability, route match and in-app chat". The code has **no Firebase dependency, no Google Maps SDK, no chat, and no route matching**. Maps are `flutter_map` + OpenStreetMap tiles with no API key. Rides carry a `seats` number but there is no seat-availability or claiming mechanism. It is also an untracked file, so it is not part of the upstream repository.
- **`README.md` is the unmodified Flutter template README** ("A new Flutter project"). It documents none of this app's behaviour.
- **Authentication is a placeholder.** `LoginScreen._login()` accepts any non-empty username and password and contains an explicit `TODO: replace with real AuthStorage.loginUser when ready`. `AuthStorage` (used only by `RegisterScreen`) stores usernames and **plain-text passwords** in `shared_preferences` under `users_list`. This is a demo-grade credential store, not a security mechanism.
- **Ride data is in-memory only.** `RideBoardScreen` keeps rides in a `List<Ride>` field; they are not persisted and disappear when the app restarts. "My rides" filters that same in-memory list.
- **No backend, no push notifications, no real-time matching, no payment, no driver app** exist in the codebase.
- **Platform identifiers are placeholders**: `applicationId` / `PRODUCT_BUNDLE_IDENTIFIER` are both `com.example.myapp1`, and release builds are signed with the debug key.
- **The web target still carries template metadata** (`<title>myapp1</title>`, description "A new Flutter project.").
- **Platform coverage is uneven**: `android`, `ios`, `linux`, `macos`, `web`, `windows` folders all exist, but only the web and Android targets are realistically usable on this Windows host today (Windows additionally needs Visual Studio; Linux and macOS need their own hosts).
- **`flutter doctor` reports Android licences as not accepted**, which blocks Gradle builds independently of the SDK issue.
- **No test, analyzer run, or app launch was performed for this document.** The only commands actually executed were `flutter --version`, `flutter doctor`, `flutter pub get --dry-run`, and `flutter analyze` — all of which failed at dependency resolution for the reason above.

### 6. Verification Checklist

- [ ] A Flutter SDK shipping Dart `>=3.10.1` is installed (pub suggests `3.47.7`); `flutter --version` confirms it.
- [ ] `PATH` resolves `flutter` to that newer SDK, not to `C:\Users\fauzan\Downloads\flutter_windows_3.35.2-stable`.
- [ ] `flutter pub get` completes successfully and creates `.dart_tool/package_config.json`.
- [ ] `pubspec.lock` was reviewed for unexpected changes after `flutter pub get`.
- [ ] `flutter analyze` runs to completion and its diagnostics are recorded (currently blocked).
- [ ] `flutter test` was executed and its result was recorded (1 test file, 1 test case).
- [ ] `flutter build web` succeeds, proving the whole `lib/` tree compiles.
- [ ] The app launches (`flutter run -d chrome`) and shows the `LoginScreen` with the "Welcome back" heading.
- [ ] `MaterialApp` reports its title as `College Carpool`.
- [ ] Registering a new user succeeds and the account survives an app restart (stored in `shared_preferences`).
- [ ] Logging in routes to `ProfileFormScreen` on first run and to `MainShell` afterwards.
- [ ] The three-tab `NavigationBar` (Profile / Rides / Parking) is present and switches screens.
- [ ] Posting a ride adds it to the board with a seat count, and it appears under "My rides".
- [ ] The Parking map renders OpenStreetMap tiles and the location picker returns a `LatLng`.
- [ ] `flutter doctor` reports no licence issues (run `flutter doctor --android-licenses`).
- [ ] Android build verified (optional): `flutter build apk --release`.
- [ ] Windows desktop target verified (optional, currently blocked): Visual Studio 2022 with the C++ workload installed.
- [ ] iOS/macOS targets verified (optional, macOS host required).

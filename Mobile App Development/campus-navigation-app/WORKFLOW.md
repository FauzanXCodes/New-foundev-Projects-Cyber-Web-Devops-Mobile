# FindBear (campus-navigation-app) — Setup & Test Workflow

This document covers how to install, configure, launch and test **FindBear**, the Flutter campus
navigation app in this folder. The Dart package name is **`flutter_maps`** (`pubspec.yaml:1`), the
Android application label is **`FindBear`** (`android/app/src/main/AndroidManifest.xml:13`), and the
upstream README calls the project *"Flutter Maps"*. It is a fork of `sbis04/flutter_maps`
(git remote: `https://github.com/AKP-shadow/ssn-campus-navigation-application-using-flutter`).

**Honest scope note up front:** this repository is a **legacy, pre-null-safety Flutter project**. Its
`pubspec.yaml` pins `environment.sdk: '>=2.12.0 <3.0.0'` and `cupertino_icons: ^0.1.3`, which is a
package published **before** Dart null safety. `flutter pub get` **fails** on the Flutter SDK
installed on this machine (Flutter 3.35.2 / Dart 3.9.0) — version solving cannot proceed. Every
command below that depends on a resolved `package_config.json` is therefore **blocked until you either
install a Flutter 2.x SDK or migrate the project**. This document documents both paths honestly; it
does **not** claim that the app was built or run.

**Identity note:** `project-metadata.json` labels this project *"Campus Navigation App"* with a goal of
"outdoor route + indoor floor plans, POI search and AR-style arrow hint". **No floor-plan, POI-search
or AR code exists in this checkout.** The real code is a Google-Maps directions demo with a hardcoded
campus dropdown list. The metadata is inaccurate; the code is the source of truth.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 (all commands below are PowerShell) | `Get-Host` |
| **Flutter SDK** | **Flutter 2.12.x – 2.18.x** (last stable line whose bundled Dart is `< 3.0`). **Not** the installed 3.35.2. | `flutter --version` |
| Dart SDK | `>=2.12.0 <3.0.0` (from `pubspec.yaml:21`); `pubspec.lock` narrows to `>=2.14.0 <3.0.0` | `dart --version` |
| Android Studio + SDK | SDK platform **android-29** (project uses `compileSdkVersion 29`), build-tools 29.x. **Only android-33 / android-34 are installed on this machine.** | `sdkmanager --list_installed` |
| Gradle | **6.7** (pinned by `android/gradle/wrapper/gradle-wrapper.properties`). Gradle 6.7 supports **Java 8–15 only**. | `Get-Content android\gradle\wrapper\gradle-wrapper.properties` |
| JDK | **Java 8–15** for the Gradle 6.7 build. The JDK on `PATH` here is **21**; Flutter's Android Studio JDK is **17**. Both are too new for Gradle 6.7. | `java -version` |
| **Google Maps API key** | **Required** for a real map + route. Enable *Maps SDK for Android*, *Maps SDK for iOS*, *Geocoding API* and *Directions API*, and attach a billing account (the upstream README documents the billing requirement). | <https://console.cloud.google.com/apis/credentials> |
| Android emulator or device | Required — the app has **no web/desktop target** (the platform folders are `android/` and `ios/` only) | `flutter devices` |
| macOS + Xcode | Required for the iOS target only. **Not available on Windows.** | — |
| CocoaPods | `1.10.0` (recorded in `ios/Podfile.lock`); a modern Xcode ships a newer one, which is usually fine | `pod --version` |
| Internet | Required for `flutter pub get` (pub.dev), the Gradle/Maven download and the Google Maps APIs | — |
| Node.js / MongoDB | **Not required** — this is a pure Flutter app with no backend | — |

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\campus-navigation-app"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 The blocker: `flutter pub get` fails on the installed SDK

`flutter pub get` was executed in this checkout against the installed **Flutter 3.35.2 / Dart 3.9.0**
and **failed**. Verified output:

```
flutter : The current Dart SDK version is 3.9.0.

Because cupertino_icons 0.1.3 doesn't support null safety and no versions of cupertino_icons match >0.1.3 <0.2.0,
cupertino_icons ^0.1.3 is forbidden.
So, because flutter_maps depends on cupertino_icons ^0.1.3, version solving failed.

The lower bound of "sdk: '>=2.0.0-dev.28.0 <3.0.0'" must be 2.12.0 or higher to enable null safety.

Failed to update packages.
```

Root cause chain, all read from the source files:

| Constraint | Value | Source |
|---|---|---|
| Dart SDK range | `>=2.12.0 <3.0.0` | `pubspec.yaml:21` |
| `cupertino_icons` | `^0.1.3` — published before null safety | `pubspec.yaml:30` |
| `google_maps_flutter` | `^2.0.6` | `pubspec.yaml:31` |
| `geolocator` | `7.0.3` | `pubspec.yaml:32` |
| `geocoding` | `2.0.0` | `pubspec.yaml:33` |
| `flutter_polyline_points` | `^1.0.0` | `pubspec.yaml:34` |
| `dio` | `^4.0.0` | `pubspec.yaml:35` |
| `csv` | `^5.0.1` | `pubspec.yaml:36` |
| dev: `flutter_launcher_icons` | `^0.9.2` | `pubspec.yaml:40` |

The installed Dart 3.9.0 is outside `<3.0.0`, and `cupertino_icons 0.1.3` has no null-safe
successor inside the `>0.1.3 <0.2.0` range, so the solver has no legal candidate.

#### 2.2 Option A (recommended, least invasive): install a Flutter 2.x SDK

Download **Flutter 2.18.x** (the last stable release bundling Dart 2.19, i.e. `< 3.0.0`) and put it
first on `PATH`. Flutter supports side-by-side installs — just change the SDK directory:

```powershell
# Point at the 2.x SDK for this project only
$env:Path = "C:\src\flutter-2.18.6\bin;" + $env:Path
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\campus-navigation-app"

flutter --version      # must report Dart 2.19.x, NOT 3.x
flutter config --no-analytics
```

Then resolve and run:

```powershell
flutter pub get
flutter analyze
flutter run
```

`pubspec.lock` is already committed and pins a resolved, null-safe-capable graph
(`cupertino_icons 0.1.3`, `geolocator 7.0.3`, `google_maps_flutter 2.0.6`, `csv 5.0.1`,
`flutter_launcher_icons 0.9.2`), so `pub get` should reuse it.

> **Not verified in this checkout.** The only Flutter SDK present on this machine is 3.35.2, so the
> 2.x resolve has not been executed here. Treat the result as expected, not confirmed.

#### 2.3 Option B: migrate the project to null safety / Flutter 3.x

This is a **real code migration**, not a one-line change. At minimum you must change:

| Change | From | To (indicative — verify each against the SDK 57-era docs / pub.dev) |
|---|---|---|
| SDK constraint | `sdk: '>=2.12.0 <3.0.0'` | `sdk: '>=3.0.0 <4.0.0'` |
| Icons | `cupertino_icons: ^0.1.3` | `cupertino_icons: ^1.0.8` |
| Maps | `google_maps_flutter: ^2.0.6` | `google_maps_flutter: ^2.5.0` (requires `compileSdk 34`, AGP 7/8) |
| Location | `geolocator: 7.0.3` | `geolocator: ^13.0.0` (the permission API changed) |
| Geocoding | `geocoding: 2.0.0` | `geocoding: ^3.0.0` |
| Polyline | `flutter_polyline_points: ^1.0.0` | `flutter_polyline_points: ^2.0.0` |
| CSV | `csv: ^5.0.1` | `csv: ^6.0.0` |
| Launcher icons | `flutter_launcher_icons: ^0.9.2` | `flutter_launcher_icons: ^0.14.0` |

Then fix the **Flutter 3.x Android Gradle breakage** (see 2.4) and the source-level issues listed in
2.6.

#### 2.4 The Android Gradle build is also Flutter-2.x-only

Even after `pub get` succeeds, `flutter build apk` will fail on Flutter 3.x. Verified in the installed
SDK: `packages/flutter_tools/gradle/flutter.gradle` now **throws on load**:

```
// This file existed solely for the compatibility with apps that have
// not migrated to the declarative apply of the Flutter Gradle Plugin.
// The old (imperative) apply of this plugin is not possible anymore.

throw new GradleException("You are applying Flutter's main Gradle plugin imperatively using \
the apply script method, which is not possible anymore. ...")
```

The project uses exactly that removed mechanism, plus several other Flutter-2.x-era constructs:

| File | Flutter-2.x construct | Status under Flutter 3.35.2 |
|---|---|---|
| `android/app/build.gradle:26` | `apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"` | **Removed** — throws a `GradleException` |
| `android/settings.gradle:6` | reads the `.flutter-plugins` file | **Removed** — `flutter_tools` no longer writes `.flutter-plugins` (verified: no reference to it in `packages/flutter_tools/lib/src/plugins.dart`) |
| `android/build.gradle:4,9` | `jcenter()` (sunset), `com.android.tools.build:gradle:3.5.0` | AGP 3.5.0 requires Gradle 5.4.1–5.6.4, but the wrapper pins **Gradle 6.7** |
| `android/build.gradle:2` | `kotlin_version = '1.6.10'` | — |
| `android/app/build.gradle:29,42,43` | `compileSdkVersion 29`, `minSdkVersion 20`, `targetSdkVersion 28` | **android-29 is not installed** on this machine (only android-33 / android-34) |
| `android/gradle/wrapper/…` | Gradle **6.7** | Gradle 6.7 supports **Java 8–15**; the JDK here is 17 (Flutter's) / 21 (on `PATH`) |

**Under Option A (Flutter 2.18.x)** the Gradle side still needs a Java 8–15 JDK installed and
`android-29` + build-tools 29.x installed via `sdkmanager`, because the wrapper's Gradle 6.7 will not
run on Java 17/21 and AGP 3.5.0 will not find `android-29`.

**Under Option B (Flutter 3.x)** the whole `android/` Gradle block has to be regenerated with the
declarative plugins block, AGP 8.x, `compileSdk 34+`, and `ndkVersion` aligned to the installed NDK
(27.0.12077973 is the only NDK present).

#### 2.5 Google Maps API keys — three separate places, one of them already broken

The app needs a Google Maps key in **three** locations, and they are **not** in sync:

| Location | What is there now | State |
|---|---|---|
| `lib/secrets.dart:3` | `Secrets.API_KEY` — a **real, non-placeholder key is committed to the repository**. It is passed to `PolylinePoints.getRouteBetweenCoordinates(...)` in `lib/Screens/map_view/map_state.dart:358`. | Key value **not reproduced here**. Treat it as compromised: rotate it in Google Cloud and move it out of source control. |
| `android/app/src/main/AndroidManifest.xml:17-18` | `<meta-data android:name="com.google.android.geo.API_KEY" android:value="…"/>` — also a **real key**, committed. | Key value **not reproduced here**. Rotate it. |
| `ios/Runner/AppDelegate.swift:12` | `GMSServices.provideAPIKey("YOUR KEY HERE")` — the literal placeholder. | **The iOS build cannot show a map** until you insert a real key here. |

Neither key is printed in this document. To insert your own:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\campus-navigation-app"

# iOS: replace the placeholder only (never paste a key into a shared doc or a commit)
notepad ios\Runner\AppDelegate.swift
#   GMSServices.provideAPIKey("YOUR KEY HERE")   ->   GMSServices.provideAPIKey("<YOUR_KEY>")
```

Prerequisites for a working key: a Google Cloud project with billing enabled, and these APIs
enabled — **Maps SDK for Android**, **Maps SDK for iOS**, **Geocoding API**, **Directions API**.
The upstream README states explicitly that without billing the Directions call fails with a
*billing* error.

Also confirm the location permission plumbing (already present in the repo):

| Requirement | Present at |
|---|---|
| `ACCESS_FINE_LOCATION` | `android/app/src/main/AndroidManifest.xml:9` |
| `NSLocationWhenInUseUsageDescription` | `ios/Runner/Info.plist:25-26` |
| `io.flutter.embedded_views_preview` = `YES` | `ios/Runner/Info.plist:46-47` |

#### 2.6 Source-level issues you will hit at runtime (read from the code)

These are **not** migration speculation; they are in the checked-in Dart and will misbehave:

1. **`lib/Screens/map_view/map_state.dart:22`** — `File('./assets/data/location.csv').readAsLinesSync()`
   reads from the **filesystem working directory**, not from the app bundle. On Android the CWD is `/`,
   so the path resolves to `/assets/data/location.csv`, which does not exist → the
   `_get_location_details()` lookup used by the destination dropdown throws. The correct approach
   (`rootBundle.loadString`) is imported at line 11 but the loader `_loadAsset()` is commented out at
   lines 140-144. The CSV files are bundled as assets (`pubspec.yaml:54-57`), so `assets/data/location.csv`
   and `assets/data/route.csv` *are* in the APK — just not reachable through `File()`.
2. **`lib/Screens/map_view/map_state.dart:669-698`** — `_addmarker()` declares `late Marker _origin;`
   and then immediately tests `if (_origin == null …)`. A `late` non-nullable local throws
   `LateInitializationError` on the **first** long-press on the map.
3. **`lib/Screens/login/login.dart:87,115` and `register/register.dart`** — `RaisedButton` was
   deprecated in Flutter 1.22 and has since been removed (there is no `raised_button.dart` left in
   `packages/flutter/lib/src/material/` in the installed 3.35.2 SDK). It still exists in the
   Flutter 2.x line, so Option A is unaffected and Option B must rewrite these widgets.
4. **`lib/Screens/map_view/map_state.dart:508`** — `focusColor: Color(6)` is an invalid colour literal
   (an ARGB int of `0x00000006` — fully transparent black). The `Color(int)` constructor itself still
   exists in `dart:ui` in Flutter 3.35.2, so this is a logic bug rather than a compile error.
5. **`lib/Screens/map_view/map_state.dart:225-239`** — the destination `Marker` (lines 226-234) and
   both `markers.add(...)` calls (lines 238-239) are commented out, so only the start marker
   (line 215) is ever built and the map shows no pins.
6. `assets/data/` also ships `junk.py` and `trial.dart` as bundled assets (they are listed via the
   `assets/data/` directory entry in `pubspec.yaml:57`).

#### 2.7 iOS dependency state

`ios/Podfile.lock` is **stale** relative to `pubspec.yaml`: it pins `geolocator (6.0.0+4)` and
`google_maps_flutter (0.0.1)` (i.e. the *plugin wrapper* versions from the original upstream repo),
whereas `pubspec.yaml` asks for `geolocator 7.0.3` and `google_maps_flutter 2.0.6`. Delete
`ios/Podfile.lock` and `ios/.symlinks/` and re-run `pod install` after a successful `flutter pub get`.

---

### 3. Launch the Complete Project

#### 3.1 Entry point and screen flow

| Step | File | Widget |
|---|---|---|
| Process entry | `lib/main.dart:5-7` | `main()` → `runApp(MyApp())` |
| App widget | `lib/main.dart:9-20` | `MyApp` → `MaterialApp(title: 'Flutter Maps', home: LoginScreen())` |
| Screen 1 | `lib/Screens/login/login.dart:7` | `LoginScreen` — Username/Password fields, a `LOGIN` button whose `onPressed` is `() {}` (no-op), and a **"Continue without login"** button |
| Screen 2 | `lib/Screens/map_view/map_state.dart:16` | `MapView` — `GoogleMap` + polyline + distance |
| Screen 3 | `lib/Screens/register/register.dart` | `RegisterScreen` |
| Shared widget | `lib/components/background.dart` | `Background` (stacked `assets/images/*.png`) |

There is **no real authentication** — the `LOGIN` button does nothing, and `RegisterScreen` is
presentational only. The way into the map is **"Continue without login"** (`login.dart:115-119`).

#### 3.2 Run on an Android device or emulator

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\campus-navigation-app"

flutter devices                 # list targets
flutter pub get                 # MUST succeed first (see 2.1)
flutter run                     # debug build onto the selected device
```

Stop with `Ctrl+C`. `flutter run -d <device-id>` pins the target.

#### 3.3 Build artefacts

```powershell
# Android debug APK
flutter build apk --debug

# Android release APK (note: android/app/build.gradle:49-54 signs release with the DEBUG key)
flutter build apk --release

# Android App Bundle
flutter build appbundle

# iOS (macOS only, and only after AppDelegate.swift has a real key)
flutter build ios
```

#### 3.4 Ports

| Component | Port | Direction | Address |
|---|---|---|---|
| The app itself | — | — | **No local server.** The APK/IPA opens no listening TCP port. |
| Google Maps SDK (tile + marker rendering) | **443** | outbound | `https://maps.googleapis.com` |
| Directions API (called by `flutter_polyline_points`) | **443** | outbound | `https://maps.googleapis.com/maps/api/directions/json` |
| Geocoding API (`geocoding` plugin) | **443** | outbound | `https://maps.googleapis.com/maps/api/geocode/json` |
| Dart VM Service / DevTools (debug only) | ephemeral | loopback | the port is printed by `flutter run` |
| Android emulator adb bridge (if used) | 5554 / 5555 | loopback | `adb` |

---

### 4. Test the Project

#### 4.1 There is **no automated test suite** in this checkout

`Test-Path .\test` returns **`False`** — there is no `test/` directory, so `flutter test` has no
files to run. The git history confirms this was deliberate: commit `5742320` / `aeee883` include
*"Delete test directory"*. `flutter_test` is still declared as a dev dependency
(`pubspec.yaml:37-39`), but no test file imports it.

**Do not expect `flutter test` to produce a pass/fail result — there is nothing to execute.**

#### 4.2 Static analysis — and why the output is meaningless until `pub get` succeeds

`flutter analyze` **cannot** produce meaningful results before a successful `flutter pub get`,
because the analyzer needs `.dart_tool/package_config.json` to resolve `package:` imports.

Verified in this checkout, with `--no-pub` (i.e. exactly the state you are in after `pub get`
fails):

```
flutter : 440 issues found. (ran in 0.7s)
```

The output is dominated by **spurious** errors that are artifacts of the missing package config, not
real defects:

```
error - Target of URI doesn't exist: 'package:flutter/material.dart' - lib\main.dart:1:8 - uri_does_not_exist
error - Target of URI doesn't exist: 'package:flutter_polyline_points/flutter_polyline_points.dart' - lib\Screens\map_view\map_state.dart:4:8 - uri_does_not_exist
error - The method 'Text' isn't defined for the type 'LoginScreen' - lib\Screens\login\login.dart:49:22 - undefined_method
error - Classes can only extend other classes - lib\Screens\map_view\map_state.dart:16:23 - extends_non_class
error - Undefined name 'Secrets' - lib\Screens\map_view\map_state.dart:358:7 - undefined_identifier
```

Treat every one of these as **noise until `flutter pub get` succeeds**. Once it does, re-run
`flutter analyze` and only then judge the real findings.

Correct order:

```powershell
flutter pub get      # must succeed
flutter analyze      # now meaningful
```

#### 4.3 Manual smoke test (requires a working build — currently blocked)

1. Launch the app. The **FindBear** login screen appears with the `assets/images/main.png` background
   and the "FindBear" title bar (`login.dart:23-45`).
2. Tap **LOGIN** → **nothing happens** (the handler is `() {}`, `login.dart:88`). This is expected
   behaviour, not a crash.
3. Tap **"Continue without login"** → the map screen opens.
4. On the map screen, grant the location permission when prompted. `_getCurrentLocation()`
   (`map_state.dart:147`) calls `Geolocator.getCurrentPosition(...)`; the console prints
   `CURRENT POS: …`.
5. The map should initialise on `LatLng(12.752725872023166, 80.19659423867354)` at zoom 18
   (`map_state.dart:58-59`) — the SSN campus area.
6. Expand the **destination dropdown**. The list is hardcoded in `map_state.dart:512-530`
   (e.g. `Department of Information Technology`, `Main Auditorium`, `Main Canteen`, `SNU`).
   **Expect this to throw / fail** because of the `File('./assets/data/location.csv')` bug (2.6.1).
7. Enter a **Start** address (or tap the locate icon to fill it from the GPS fix).
8. Tap **SHOW ROUTE**. Expected: a red polyline is drawn and the label reads
   `DISTANCE: <n> km`. This requires a working Directions API key and billing.
9. Long-press the map → adds a blue marker. **Expect a `LateInitializationError`** (2.6.2).

#### 4.4 Asset / data checks

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\campus-navigation-app"

# The bundled datasets that back the campus dropdown
Get-Content assets\data\location.csv -TotalCount 5
Get-Content assets\data\route.csv -TotalCount 3
```

`location.csv` has columns `point_no,lat_lng,label,adj` and starts with
`1,"12.751617010495364, 80.20367432693531","SSN Main Entrance, Entrance",2`.
`route.csv` adds an `is_marker` column. These are the real campus waypoints for SSN.

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Because cupertino_icons 0.1.3 doesn't support null safety … version solving failed` | The project is pre-null-safety; the installed Dart is 3.9.0 | Install Flutter **2.12–2.18.x** (2.1 / 2.2), or migrate the dependency set (2.3) |
| `The current Dart SDK version is 3.9.0.` | Same as above | Same fix |
| `flutter analyze` reports hundreds of `uri_does_not_exist` / `undefined_method` errors | No `.dart_tool/package_config.json` because `pub get` failed | Fix `pub get` first; the errors are spurious (4.2) |
| `You are applying Flutter's main Gradle plugin imperatively using the apply script method, which is not possible anymore.` | `android/app/build.gradle:26` uses the removed `apply from: …/flutter.gradle` | Use Flutter 2.x (2.2), or migrate `android/` to the declarative plugins block + AGP 8 (2.4) |
| `Failed to find target with hash string 'android-29'` | `compileSdkVersion 29` but only android-33/34 are installed | `sdkmanager "platforms;android-29" "build-tools;29.0.3"`, or raise `compileSdkVersion` during a migration |
| `Unsupported class file major version 61` / `Unsupported class file major version 65` from Gradle | Gradle **6.7** supports Java 8–15; the JDK is 17/21 | Point `JAVA_HOME` at a JDK 11 install, or upgrade Gradle + AGP during a migration |
| `jcenter()` resolution failures / dead `bintray` repos | `android/build.gradle:4,16` still uses the sunset `jcenter()` | Replace with `mavenCentral()` / `google()` |
| Map is blank / grey tiles on Android | The key in `AndroidManifest.xml` is invalid, expired, or the Maps SDK is not enabled on that GCP project | Rotate and re-insert a valid key; enable *Maps SDK for Android* + billing |
| Map is blank on iOS | `ios/Runner/AppDelegate.swift:12` still contains the literal `"YOUR KEY HERE"` | Insert a real key there (2.5) |
| "SHOW ROUTE" does nothing / snackbar says *"Error Calculating Distance"* | Directions API key missing, billing not enabled, or the start/destination fields are empty | Enable billing; fill both fields; check the console for the exception printed by `map_state.dart:333` |
| Dropdown destination selection crashes | `File('./assets/data/location.csv')` does not exist at runtime (2.6.1) | Switch the loader to `rootBundle.loadString('assets/data/location.csv')` |
| First long-press on the map throws `LateInitializationError` | `late Marker _origin;` is read before assignment (2.6.2) | Initialise `_origin` / `_destination` to a nullable field |
| `pod install` fails or the pods are the wrong versions | `ios/Podfile.lock` pins stale plugin versions (2.7) | Delete `ios/Podfile.lock` and `ios/.symlinks/`, then `pod install` after `pub get` |
| `flutter devices` shows no Android target | No emulator running / no device attached | Start an AVD from Android Studio, or `adb devices` to confirm |

**Known limitations to state honestly**

* **The project does not currently build on the toolchain installed on this machine.** `flutter pub get`
  fails; `flutter analyze` output is noise; the Android Gradle layer is Flutter-2.x-only; the iOS
  Podfile lock is stale. No build, run or test of this app has been performed.
* **No automated tests exist** — the `test/` directory was deleted in the git history. Any "testing"
  of this project is manual.
* **The login is a no-op.** `onPressed: () {}` — there is no backend, no session, no user model.
* **The Google Maps key is committed in two places** (`lib/secrets.dart`, `AndroidManifest.xml`) and the
  iOS key is still a placeholder. Rotate the committed key; never publish it.
* **The campus data is hardcoded.** The destination list lives in the Dart source
  (`map_state.dart:512-530`) and the waypoints in `assets/data/*.csv`; neither is fetched from a
  service. There is no POI search, no indoor floor plan and no AR feature despite what
  `project-metadata.json` claims.
* **No web or desktop target.** Only `android/` and `ios/` platform folders exist.
* **The Directions route is a real Google Directions API call**, so route drawing is metered, requires
  billing, and needs network access — it will not work offline.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Toolchain**

- [ ] `flutter --version` reports a **2.x** Flutter with a Dart version `< 3.0.0`
- [ ] `flutter doctor` shows the Android toolchain without a fatal error
- [ ] `sdkmanager --list_installed` shows `platforms;android-29` and `build-tools;29.x`
- [ ] `java -version` reports a JDK between 8 and 15 for the Gradle 6.7 build

**Dependency resolution**

- [ ] `flutter pub get` completes with **no** "version solving failed" message
- [ ] `Test-Path .\.dart_tool\package_config.json` returns `True`
- [ ] `Test-Path .\test` returns `False` and you accept that there is **no** automated test suite
- [ ] `flutter analyze` (run **after** `pub get`) reports a much smaller issue count than the
      440 spurious issues seen with `--no-pub`, and you have read the remaining ones

**Keys and configuration**

- [ ] A Google Cloud project has billing enabled
- [ ] *Maps SDK for Android*, *Maps SDK for iOS*, *Geocoding API* and *Directions API* are enabled
- [ ] `lib/secrets.dart` holds **your** rotated key (the committed one has been revoked)
- [ ] `android/app/src/main/AndroidManifest.xml` holds **your** rotated key
- [ ] `ios/Runner/AppDelegate.swift` no longer contains the literal `YOUR KEY HERE`
- [ ] `android/app/src/main/AndroidManifest.xml` still contains `ACCESS_FINE_LOCATION`
- [ ] `ios/Runner/Info.plist` still contains `NSLocationWhenInUseUsageDescription`

**Build and launch**

- [ ] `flutter run` builds and installs on an Android device or emulator
- [ ] The app opens on the **FindBear** login screen with the background image
- [ ] Tapping **LOGIN** does nothing (expected — the handler is empty)
- [ ] Tapping **"Continue without login"** opens the map screen
- [ ] The map renders tiles centred near `12.7527, 80.1966` at zoom 18
- [ ] The location permission prompt appears and `CURRENT POS: …` is printed to the console
- [ ] The destination dropdown lists the hardcoded campus locations (or you have documented the
      `location.csv` failure from 2.6.1)
- [ ] **SHOW ROUTE** draws a red polyline and prints `DISTANCE: <n> km`
- [ ] `flutter build apk --release` produces an artefact in `build\app\outputs\flutter-apk\`

**Housekeeping**

- [ ] Any real API key was rotated in Google Cloud, and no key was committed or shared
- [ ] `Get-NetTCPConnection -State Listen` shows no stray process on the ports from the table in 3.4
- [ ] You have recorded that the iOS target was **not** exercised (requires macOS + Xcode)

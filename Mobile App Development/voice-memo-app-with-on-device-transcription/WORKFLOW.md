# Image Voice Memos (voice-memo-app-with-on-device-transcription) — Setup & Test Workflow

A native **macOS SwiftUI** application ("Image Voice Memos", version 0.1.1) that browses photos from a user-selected folder and records one voice memo per photo, transcribing it entirely on-device with Apple's Speech framework (and optionally translating German → English with the Translation framework). The Xcode project is **not committed** — it is generated from `project.yml` with XcodeGen.

**Scope note — this is NOT an Android or iOS mobile app.** It lives in the `Mobile App Development` folder and `project-metadata.json` claims `"stack": "Kotlin; Whisper.cpp/ML Kit"`, but there is no Kotlin, no Gradle, no Android manifest, no Whisper.cpp, and no ML Kit anywhere in the tree. The real project is a **macOS 15.0+ Apple-Silicon desktop app** (Swift 5, SwiftUI, MVVM, AppKit) that talks to no server and needs no network at runtime. Its `entry` in `project-metadata.json` is listed as `docs/index.html` — a static documentation page, not the application entry point, which is `Image-Voice-Memos/App/ImageVoiceMemosApp.swift`. The metadata also advertises "search across transcripts and share"; neither feature exists in the code.

Everything below was derived by reading the files in this checkout. **Nothing was generated, built, or run** — the project requires macOS with Xcode 16 and an Apple Silicon Mac, and the machine used to write this document is Windows. Unverified steps are labelled as such.

---

### 1. Prerequisites

| Item | Required value | Where it comes from / how to check |
|---|---|---|
| Host OS | **macOS 15.0 Sequoia or later** | `README.md:32-38`, `project.yml:4-5` (`deploymentTarget: macOS: "15.0"`), `Info.plist` `LSMinimumSystemVersion = 15.0` |
| CPU | **Apple Silicon (M1 or later)** — `ARCHS: arm64` and `EXCLUDED_ARCHS[sdk=macosx*]: x86_64` in `project.yml:55-56`. There is no Intel build | `project.yml:55-56`, `README.md:34` |
| Xcode | **16.0 or later** — `project.yml:6` sets `xcodeVersion: "16"` | `project.yml:6`, `README.md:36` |
| XcodeGen | **2.x** — `brew install xcodegen`. Not committed, not vendored | `README.md:37,46-47`, `project.yml` header |
| Xcode command line tools | `xcode-select -s /Applications/Xcode.app/Contents/Developer` (as documented in `.github/BUILD.md:6-9`) | `.github/BUILD.md` |
| Code signing | `CODE_SIGN_STYLE: Automatic` with `DEVELOPMENT_TEAM: ""` (`project.yml:51-52`). An empty team means a **local/ad-hoc signature** — fine for running on your own machine, but the app will be un-notarised and Gatekeeper-blocked on other machines | `project.yml:51-52`, `.github/BUILD.md:64` |
| Microphone permission | Required at runtime; `NSMicrophoneUsageDescription` is set in both `project.yml:29` and `Info.plist` | `Info.plist:26-27` |
| Speech Recognition permission | Required at runtime; `NSSpeechRecognitionUsageDescription` is set in `project.yml:30` and `Info.plist` | `Info.plist:30-31` |
| On-device language models | The app forces `request.requiresOnDeviceRecognition = true` (`TranscriptionService.swift:39`), so the German/English speech models must be downloadable/installed on the machine. Translation (`TranslationService`) uses Apple's `Translation` framework, which also needs its on-device models | `TranscriptionService.swift:39` |
| Test data | A folder of images. The repo ships **no sample photos** — `Assets/AppIcon/` holds only app-icon PNGs, `docs/` holds the icon and a screenshot. You must point the app at your own folder | directory listing of the repo |
| Environment variables | **None.** No `.env`, no build settings with secrets, no runtime configuration file | grep/read of all sources and `project.yml` |
| Ports | **8765** — the only port in the repository, used by the optional documentation preview (`.claude/launch.json`: `python3 -m http.server 8765 -d docs`). The application itself opens no sockets; all speech/translation is on-device | `.claude/launch.json` |

---

### 2. Installation and Setup

#### 2.1 Windows-side preflight (everything possible on this machine)

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\voice-memo-app-with-on-device-transcription"
Get-ChildItem -Force
Get-ChildItem -Recurse -Filter *.swift | Measure-Object | Select-Object -ExpandProperty Count
Test-Path -LiteralPath ".\Image-Voice-Memos.xcodeproj"
```

Expect:

- 23 Swift source files under `Image-Voice-Memos/` (2 App, 2 Models, 7 Services, 2 Utilities, 2 ViewModels, 8 Views).
- `Test-Path ".\Image-Voice-Memos.xcodeproj"` → **False**. `.gitignore:2` ignores `*.xcodeproj/`, and `git ls-files` confirms no `.xcodeproj` is tracked. The Xcode project is generated, never committed. This is by design (see `CLAUDE.md`, "The `.xcodeproj` is not committed to git").
- `project.yml`, `create-dmg.sh`, `CLAUDE.md`, `README.md`, `.github/BUILD.md`, `.github/release-notes.md`, `docs/index.html`, `.claude/launch.json` are present.

None of this builds the app. The steps below require macOS.

#### 2.2 macOS-side: install XcodeGen

```bash
brew install xcodegen
xcodegen --version
```

`README.md:43-47` gives `brew install xcodegen`; the requirement is XcodeGen 2.x. Homebrew itself is a prerequisite for this step (install from https://brew.sh on Apple Silicon).

#### 2.3 macOS-side: generate the Xcode project

```bash
cd "/path/to/voice-memo-app-with-on-device-transcription"
xcodegen generate
```

This reads `project.yml` and writes `Image-Voice-Memos.xcodeproj` (the project name comes from `name: Image-Voice-Memos` in `project.yml:1`). It also defines the shared scheme `Image-Voice-Memos` (`project.yml:9-15`) with `run.config: Debug`.

Re-run `xcodegen generate` after **any** change to the file set or to `project.yml` — the generated project is disposable and is not committed.

#### 2.4 macOS-side: open and build

```bash
open Image-Voice-Memos.xcodeproj
```

Then in Xcode press **Cmd+B** to build and **Cmd+R** to run (`README.md:62-68`).

Command-line equivalent (macOS):

```bash
xcodebuild -project Image-Voice-Memos.xcodeproj \
  -scheme Image-Voice-Memos \
  -configuration Debug \
  build
```

The build product is `Image-Voice-Memos.app`, bundle id `com.adrian-altner.imagevoicememos`, marketing version `0.1.1`, build `1`, `SWIFT_VERSION = 5.0`, hardened runtime enabled, App Sandbox enabled with `com.apple.security.device.audio-input` and `com.apple.security.files.user-selected.read-write` (`project.yml:37-57`).

**No third-party dependencies.** `project.yml` declares no Swift packages, there is no `Package.resolved`, and the code imports only Apple frameworks (SwiftUI, AppKit, AVFoundation, Speech, Translation, CoreGraphics, UniformTypeIdentifiers). The build therefore needs no network access — unlike the marketplace project, which resolves a remote package.

#### 2.5 macOS-side: first-launch permissions

On first launch the app requests two permissions (`README.md:72-91`):

| Permission | Why | Where to fix it manually if denied |
|---|---|---|
| Microphone | To record voice memos | System Settings → Privacy & Security → Microphone → enable "Image Voice Memos" |
| Speech Recognition | To transcribe recordings on-device | System Settings → Privacy & Security → Speech Recognition → enable "Image Voice Memos" |

Both are backed by usage-description strings already present in `Info.plist`, so the system dialog appears with real text. Grant both, then restart the app.

#### 2.6 macOS-side: optional DMG build (correcting a common assumption)

`create-dmg.sh` is a 56-line bash script that:

1. Runs `xcodegen generate` **only if** `Image-Voice-Memos.xcodeproj` is missing (lines 11-14).
2. Builds Release via `xcodebuild -project … -scheme Image-Voice-Memos -configuration Release -derivedDataPath build build` (lines 17-21).
3. Verifies `build/Build/Products/Release/Image-Voice-Memos.app` exists (lines 23-28).
4. Stages the app plus a symlink to `/Applications`, then creates the disk image with **`hdiutil create`** — the `hdiutil` tool that ships with macOS (lines 32-43).
5. Removes the staging directory and prints the install instructions (lines 46-56).

**The script does NOT require the Homebrew `create-dmg` tool.** The Homebrew requirements are `xcodegen` (needed for step 1) and, for publishing only, `gh` (the GitHub CLI, per `.github/BUILD.md:10-11`). `hdiutil` and `xcodebuild` are part of the Xcode command line tools.

```bash
./create-dmg.sh
```

Output: `build/Image-Voice-Memos-v0.1.1.dmg` (the version string comes from `VERSION="0.1.1"` at `create-dmg.sh:7`; the same version also lives in `project.yml:33,45` and `Info.plist:22-23`, and must be updated in all three places when bumping it — `.github/BUILD.md:26-34`).

Because the app is ad-hoc signed and not notarised, recipients must run:

```bash
xattr -rd com.apple.quarantine /Applications/Image-Voice-Memos.app
```

Publishing to GitHub Releases is a separate optional step (`.github/BUILD.md:36-60`):

```bash
gh release create v0.1.1 build/Image-Voice-Memos-v0.1.1.dmg \
  --title "v0.1.1" \
  --notes-file .github/release-notes.md
```

#### 2.7 macOS-side: optional documentation preview

The only network-facing artifact in the repository is the static docs site, which loads Mermaid from `cdn.jsdelivr.net` and is served locally per `.claude/launch.json`:

```bash
python3 -m http.server 8765 -d docs
```

Then open `http://localhost:8765/`. This serves the documentation site; it is not the application.

---

### 3. Launch the Complete Project

#### 3.1 Entry point chain (read from the sources)

| Level | File | Detail |
|---|---|---|
| App entry | `Image-Voice-Memos/App/ImageVoiceMemosApp.swift:3-30` | `@main struct ImageVoiceMemosApp: App` with `@NSApplicationDelegateAdaptor(AppDelegate.self)`, two `@StateObject`s (`LibraryViewModel`, `VoiceMemoViewModel`), a `WindowGroup` hosting `ContentView()` with `.frame(minWidth: 800, minHeight: 500)`, `.windowStyle(.titleBar)`, and a **File → Open Folder…** command bound to **Cmd+O** |
| App lifecycle | `Image-Voice-Memos/App/AppDelegate.swift:4-5` | `applicationShouldTerminateAfterLastWindowClosed` → `true` (the app quits when its last window closes) |
| Root view | `Image-Voice-Memos/Views/ContentView.swift` | Composes the photo grid, toolbar and detail area |
| Grid | `Views/PhotoGridView.swift`, `Views/PhotoGridItemView.swift` | Grid of photos; items with a memo show a microphone badge |
| Detail | `Views/DetailView.swift` | Photo detail, transcription and translation text, copy-to-clipboard |
| Controls | `Views/VoiceMemoControlsView.swift`, `Views/WaveformView.swift`, `Views/ToolbarView.swift`, `Views/EmptyStateView.swift` | Record/Play/Delete controls, live level meter, filter/sort/folder path, empty state |

#### 3.2 Runtime services (all on-device)

| Service | File | Behaviour |
|---|---|---|
| Folder access | `Services/FolderAccessService.swift` | Security-scoped bookmark persisted in `UserDefaults` under the key `"folderBookmark"`; `restoreFolder()` is called on launch to re-acquire access |
| Image loading | `Services/ImageLoadingService.swift` | Actor; `CGImageSource` + `kCGImageSourceCreateThumbnailFromImageIfAbsent` for RAW thumbnails, `NSCache` for caching |
| Recording | `Services/AudioRecordingService.swift` | PCM 44.1 kHz / 16-bit / mono → AAC/M4A via `AVAssetExportSession`; `prepareToRecord()` must be called first or the first second is silence; a 1-second countdown (`VoiceMemoState.countingDown`) warms the hardware |
| Playback | `Services/AudioPlaybackService.swift` | `prepare()`, `playPrepared()`, `play()`, `pause()`, `resume()`, `stop()`, `duration` / `currentTime` |
| Transcription | `Services/TranscriptionService.swift` | `SFSpeechRecognizer`; locales `de-DE` and `en-US`; `requiresOnDeviceRecognition = true`; adaptive timeout `max(120 s, audioDuration × 3)`; falls back to the best partial transcript on timeout |
| Translation | `Services/TranslationService.swift` | Apple's `Translation` framework, German → English, 30-second timeout, skipped when the source language is already English |
| Storage | `Services/VoiceMemoStorageService.swift` | Hidden `.voicememos/` directory inside the selected photo folder; `<photo>.m4a`, `<photo>.txt`, `<photo>.en.txt` sidecars; `delete()` removes all three |

#### 3.3 Launch and use

1. Launch `Image-Voice-Memos.app` (Cmd+R from Xcode, or `./create-dmg.sh` then open the DMG).
2. Grant Microphone and Speech Recognition when prompted.
3. **Cmd+O** (or the folder icon in the toolbar) → pick a folder of images. The app restores the last folder on subsequent launches.
4. Click a photo → detail view opens.
5. **Record** → 1-second countdown → speak → live waveform → **Stop**.
6. The recording is converted to AAC and transcription starts automatically; the UI shows a `ProgressView` and "Processing…" while `isTranscribing` is true.
7. Optionally enable the **EN** toggle (visible when German is selected) to translate DE → EN; the result is written to `<photo>.en.txt`.
8. **Play** to listen back; the trash icon removes the memo, its transcript and its translation.

Your original photos are never modified; everything lives in the hidden `.voicememos/` subfolder of the folder you selected.

---

### 4. Test the Project

**There is no test target, no test file, and no CI workflow in this repository.** `project.yml` declares exactly one target (`Image-Voice-Memos`, `type: application`) and one scheme, with no `Tests` directory anywhere in the tree, and no XCTest/Swift Testing import in the 23 source files. There is also no `swift test` / `xcodebuild test` target to run.

Consequently the only verification is manual and interactive, and every step below is marked as not yet performed.

#### 4.1 Manual acceptance path (interactive, macOS)

| # | Step | Expected observable result | Status |
|---|---|---|---|
| 1 | `xcodegen generate` | `Image-Voice-Memos.xcodeproj` and the `Image-Voice-Memos` scheme appear | Not run |
| 2 | Cmd+B | Build succeeds; `Image-Voice-Memos.app` produced | Not run |
| 3 | Cmd+R | Window opens at ≥ 800×500 in a title-bar style window with an integrated toolbar | Not run |
| 4 | First launch | Two permission prompts appear (Microphone, Speech Recognition) | Not run |
| 5 | Cmd+O → pick a folder with ≥ 3 images | The grid populates with thumbnails | Not run |
| 6 | Relaunch the app | The previously selected folder is restored (security-scoped bookmark) | Not run |
| 7 | Select a photo | The detail view opens; the photo is displayed | Not run |
| 8 | Press **Record** | A 1-second countdown runs, then a "● Live" indicator and a live waveform appear | Not run |
| 9 | Speak for ~5 s, press **Stop** | The audio converts to `.m4a`; a `ProgressView` and "Processing…" show during transcription | Not run |
| 10 | Wait for transcription | The transcript appears in the detail view; `<photo>.txt` is written next to the memo in `.voicememos/` | Not run |
| 11 | Switch the language to German and record again | German transcript is produced (`de-DE` recognizer) | Not run |
| 12 | Enable the **EN** toggle with a German memo | A translated English text appears and `<photo>.en.txt` is written | Not run |
| 13 | Press **Play** | The memo plays with a progress bar; pause/resume work | Not run |
| 14 | Press the trash icon | `.m4a`, `.txt` and `.en.txt` are removed and the UI resets | Not run |
| 15 | Filter by "With Memo" / "Without Memo" and sort by name/date | The grid updates and thumbnails do not disappear after switching filters | Not run |
| 16 | Inspect `<photo-folder>\.voicememos\` | The three sidecar types are present, and the original photos are unmodified | Not run |
| 17 | Delete the memo but keep the `.txt` | The orphaned transcription is still shown in the UI | Not run |

#### 4.2 Edge cases the code explicitly tries to handle (useful as test cases)

- **Silence at the start of a recording** — a missing `prepareToRecord()` is the documented pitfall (`CLAUDE.md`, "Common Pitfalls" #1). Record immediately after a cold start and listen; the first second should not be silent.
- **First-transcription latency** — the on-device speech model may need to load on first use; the app shows "Processing…" during this.
- **Long recordings** — the transcription timeout is `max(120 s, audioDuration × 3)`; a very long memo may return the best partial transcript rather than the full text.
- **Playthrough queue errors** — `CLAUDE.md` notes that audio-queue errors during playback (e.g. "Error (-4)") are typically non-blocking.
- **RAW formats** — the app advertises NEF, RAF, ORF, DNG, CR2, CR3, ARW, RW2 support; verify thumbnails render for at least one RAW file.
- **Translated-only sidecars** — a `.en.txt` with no `.m4a` should still be surfaced.
- **Bookmark expiry** — if the folder cannot be re-accessed, the app should fall back to the empty state and ask for a folder again.

#### 4.3 Static checks you can perform without a Mac (Windows, no build)

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\voice-memo-app-with-on-device-transcription"
Select-String -Path ".\Image-Voice-Memos\**\*.swift" -Pattern "@main|requiresOnDeviceRecognition|NSMicrophoneUsageDescription"
Get-Content -LiteralPath ".\Image-Voice-Memos\Resources\Info.plist"
```

These confirm the entry point, the on-device flag and the usage descriptions, but they prove nothing about runtime behaviour.

---

### 5. Troubleshooting

| Symptom | Likely cause | Action (macOS) | Verified? |
|---|---|---|---|
| `xcodegen: command not found` | XcodeGen not installed | `brew install xcodegen`; verify with `xcodegen --version` | Cause verified from `README.md:46-47`; not executed |
| `error: The Xcode project at ... is not a valid macOS app project` / build cannot find `ImageVoiceMemosApp` | The project was never generated, or was generated from a stale `project.yml` | Re-run `xcodegen generate`, then reopen `Image-Voice-Memos.xcodeproj` | Cause verified from `.gitignore:2` and `CLAUDE.md` |
| Build error: `the file 'Image-Voice-Memos.app' is not a macOS application` / "unsupported architecture" | Intel Mac or Rosetta-less x86_64 machine | Requires an Apple Silicon Mac — `ARCHS: arm64` with `EXCLUDED_ARCHS[sdk=macosx*]: x86_64` (`project.yml:55-56`) | Verified from `project.yml`; not reproduced |
| "The macOS deployment target 'MACOSX_DEPLOYMENT_TARGET' is set to 15.0, but the range of supported deployment target versions is ..." | Xcode older than 16 | Install Xcode 16+; `project.yml:6` pins `xcodeVersion: "16"` | Verified from `project.yml`; not reproduced |
| `xcodebuild: error: SDK "macosx" ... cannot be located` | Xcode command line tools not selected | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (`.github/BUILD.md:6-9`), then `xcode-select -p` | Verified from `.github/BUILD.md` |
| Recording does nothing; no permission prompt | Microphone permission denied | System Settings → Privacy & Security → Microphone → enable "Image Voice Memos", then relaunch | Verified from `README.md:83-86` |
| "Speech recognition not available for de-DE" (console) | The locale is not in `SFSpeechRecognizer.supportedLocales()` on that machine, or the on-device model is missing | The check is at `TranscriptionService.swift:10`; install the German/English speech assets in System Settings → Keyboard → Dictation, and confirm the machine is Apple Silicon with macOS 15+ | Verified from the source; not reproduced |
| Transcription returns nothing / returns only a partial sentence | Adaptive timeout `max(120 s, duration × 3)` elapsed, or the first model load was slow | The timeout path logs "Transcription timed out after Ns - returning partial transcript" and returns the best partial text (`TranscriptionService.swift:107-112`) | Verified from the source |
| The first second of every recording is silent | `prepareToRecord()` was not called before `record()` | Ensure the 1-second warm-up countdown completes; see `CLAUDE.md` pitfall #1 and `Services/AudioRecordingService.swift` | Verified from `CLAUDE.md` and the service API |
| The app starts but shows the empty state instead of the photos | The security-scoped bookmark expired or the user moved/renamed the folder | Re-select the folder with Cmd+O; the bookmark is stored in `UserDefaults` under `"folderBookmark"` | Verified from `Services/FolderAccessService.swift` |
| Translation never runs | Translation is skipped when the transcription language is already English, and the "EN" toggle only appears for German | Record in German first, then enable "EN" | Verified from `CLAUDE.md` / `TranslationService` |
| "Error (-4)" during playback | Audio-queue error during playback | Documented as typically non-blocking — playback still succeeds | Verified from `CLAUDE.md` |
| The DMG opens but the app will not start on another Mac | The app is ad-hoc signed and not notarised; Gatekeeper blocks it | Right-click → Open, or run `xattr -rd com.apple.quarantine /Applications/Image-Voice-Memos.app` | Verified from `README.md:215` and `.github/BUILD.md:64-71` |
| `create-dmg.sh` fails at the `hdiutil` step | `hdiutil` is missing (Xcode CLT not selected) | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`; the script uses the built-in `hdiutil`, **not** the Homebrew `create-dmg` tool | Verified from `create-dmg.sh:40-43` |
| `gh release create` fails | GitHub CLI missing or not authenticated | `brew install gh`, then `gh auth login` | Verified from `.github/BUILD.md:10-11` |
| The docs site renders without diagrams | `docs/index.html` loads Mermaid from `cdn.jsdelivr.net`; offline machines show unrendered diagrams | Serve it with network access, or vendor the Mermaid script | Verified from `docs/index.html:6` |

---

### 6. Verification Checklist

Every item below is **unchecked** because the project was never generated, built, or run — it requires macOS 15 on Apple Silicon with Xcode 16, none of which exists on the machine where this document was produced. Tick a box only after personally observing the result.

- [ ] The machine is an Apple Silicon Mac running macOS 15.0 or later.
- [ ] Xcode 16 or later is installed and `xcode-select -p` points at it.
- [ ] `xcodegen --version` reports 2.x.
- [ ] `xcodegen generate` produced `Image-Voice-Memos.xcodeproj` and the `Image-Voice-Memos` scheme.
- [ ] `xcodebuild -project Image-Voice-Memos.xcodeproj -scheme Image-Voice-Memos -configuration Debug build` succeeds.
- [ ] The built app launches and shows the title-bar window at ≥ 800×500.
- [ ] The Microphone permission prompt appeared and was granted.
- [ ] The Speech Recognition permission prompt appeared and was granted.
- [ ] Cmd+O opens a folder picker and a photo grid appears.
- [ ] The previously selected folder is restored after a relaunch.
- [ ] Recording shows a 1-second countdown followed by a live waveform.
- [ ] The first second of the recording is not silent.
- [ ] Stopping the recording converts the audio to a `.m4a` in `.voicememos/`.
- [ ] Transcription runs on-device and writes a `.txt` sidecar (no network traffic required).
- [ ] A German recording produces a German transcript, and the "EN" toggle produces an `.en.txt` translation.
- [ ] Playback, pause and resume work with a working progress bar.
- [ ] Delete removes the `.m4a`, `.txt` and `.en.txt` sidecars together.
- [ ] Filtering by "With Memo" / "Without Memo" and sorting by name/date behave correctly, with no disappearing thumbnails.
- [ ] The original photos in the selected folder are unmodified.
- [ ] `./create-dmg.sh` produced `build/Image-Voice-Memos-v0.1.1.dmg` and the app inside it launches after the `xattr` quarantine removal.
- [ ] `python3 -m http.server 8765 -d docs` serves the documentation site on `http://localhost:8765/`.

---

#### Known limitations to state honestly

- **This is not a mobile app.** It is a macOS desktop application (SwiftUI, MVVM, AppKit). There is no Android, iOS, Kotlin, Gradle, Whisper.cpp, or ML Kit code in the repository, and the app never uses the network at runtime.
- **Nothing was generated, built, or executed while writing this document.** The project requires macOS 15 on Apple Silicon with Xcode 16 and XcodeGen; the authoring environment is Windows with Python 3.12 only. Every macOS command in §2.2–§3.3 and §4.1 is transcribed from the repository's own documentation and is unverified in execution.
- **There is no automated test target, no test file, and no CI.** `project.yml` declares a single application target. All validation in §4 is manual and interactive, and none of it has been performed.
- **The Xcode project is not committed and must be regenerated.** `xcodegen generate` is a mandatory step after every source or configuration change; the generated `.xcodeproj` is disposable.
- **The Homebrew requirement is `xcodegen` (and `gh` for releases), not `create-dmg`.** `create-dmg.sh` builds the disk image with the macOS-native `hdiutil` tool. Assuming a `create-dmg` dependency would send you to install an unnecessary package.
- **Ad-hoc signing means the built app is un-notarised.** Recipients must clear the quarantine flag manually; this is expected and documented in `.github/BUILD.md`, not a defect to chase.
- **No sample photos ship with the repository**, so the manual acceptance path requires you to supply your own image folder.
- **On-device speech and translation require downloadable Apple language models** and a genuinely Apple Silicon machine; the forced `requiresOnDeviceRecognition = true` means a missing model yields an empty or partial transcript rather than a silent cloud fallback.
- **The repository's `project-metadata.json` is inaccurate** (`"stack": "Kotlin; Whisper.cpp/ML Kit"`, `"entry": "docs/index.html"`, and a goal mentioning "search across transcripts and share"). The code has no search feature and no share feature; the real entry point is `Image-Voice-Memos/App/ImageVoiceMemosApp.swift`.
- **`DEVELOPMENT_TEAM` is empty**, so there is no Team ID for distribution or device builds; the app is intended for local use and ad-hoc sharing.

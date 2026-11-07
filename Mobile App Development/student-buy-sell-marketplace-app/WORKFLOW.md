# Panthers Marketplace (student-buy-sell-marketplace-app) — Setup & Test Workflow

A native **iOS SwiftUI** app ("Panthers Marketplace") for a campus second-hand marketplace restricted to Florida International University (FIU) students, backed by **Supabase** (Postgres + GoTrue Auth + Storage + Realtime). Sources live in `Panthers Marketplace/`, tests in `Panthers MarketplaceTests/` and `Panthers MarketplaceUITests/`, and the Supabase project configuration in `supabase/`.

**Scope note — this IS a real mobile app, but it is an iOS-only app and it cannot be built on Windows.** `project-metadata.json` claims `"stack": "Flutter; Firebase Storage"`, which is wrong for this checkout: there is no Dart/Flutter code, no Firebase configuration, and no Android project. The real stack is Swift + SwiftUI + MVVM + the `supabase-swift` Swift Package, with a `Panthers Marketplace.xcodeproj` that is an Apple-platform Xcode project. Building, running, and testing it require macOS with Xcode 16 or later — a hard blocker on a Windows-only machine, including the machine this document was written on.

Everything below was derived by reading the files in this checkout. **Nothing was built, launched, or tested** — no Xcode, no macOS, and no iOS Simulator is available here. Steps that could not be verified are labelled as such.

---

### 1. Prerequisites

| Item | Required value | Where it comes from / how to check |
|---|---|---|
| Host OS | **macOS** (any recent version that supports Xcode 16) | Xcode/iOS project — `Panthers Marketplace.xcodeproj/project.pbxproj` |
| Xcode | **16 or later.** `project.pbxproj` has `objectVersion = 77;` and `preferredProjectObjectVersion = 77;`; the shared scheme has `LastUpgradeVersion = "2600"`. The unit test target uses `import Testing` (Swift Testing), which ships with Xcode 16 | `project.pbxproj`, `xcshareddata/xcschemes/Panthers Marketplace.xcscheme`, `Panthers MarketplaceTests/Panthers_MarketplaceTests.swift:8` |
| iOS SDK | **18.2 or later** — `IPHONEOS_DEPLOYMENT_TARGET = 18.2` on the app and both test targets (pbxproj lines 356, 413, 489, 508) | `project.pbxproj` |
| Swift language level | `SWIFT_VERSION = 5.0` for all three targets | `project.pbxproj` |
| Device / simulator | An iOS 18.2+ simulator or a physical iOS device | `README.md:75-81` |
| Network access | Required on first build: Swift Package Manager must resolve `supabase-swift` from `https://github.com/supabase-community/supabase-swift.git` (minimumVersion `2.5.1`). `Package.resolved` is listed in `.gitignore:25` and is **not** committed, so resolution always happens fresh | `project.pbxproj` `XCRemoteSwiftPackageReference`, `.gitignore:25` |
| Supabase project | Required. The app talks to a hosted Supabase instance at runtime | `README.md:61-71` |
| Environment variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF` — read at runtime from the bundled `Panthers Marketplace/App.env` | `README.md:65-70`, `Services/SupabaseService.swift:12-23`, `supabase/SupabaseConfig.swift` |
| Supabase CLI (optional) | Only needed for a **local** Supabase stack. `supabase/.temp/cli-latest` records `v2.53.6` as the CLI version last used here | `supabase/.temp/cli-latest` |
| Docker (optional) | Required by `supabase start` for the local stack. **Not installed on this machine** — `docker --version` returns "docker not found" | shell check |
| Apple Developer account | Not required for simulator builds. `DEVELOPMENT_TEAM` is not set in the project; a physical device build will need a team | `project.pbxproj` build settings |

**Ports**

| Port | Protocol | Purpose | Source |
|---|---|---|---|
| 5432 | TCP | PostgreSQL pooler for the hosted Supabase project | `supabase/.temp/pooler-url` (`*.pooler.supabase.com:5432/postgres`) |
| 443 | TCP | HTTPS to the Supabase project — REST, Auth, Storage, Realtime, Edge Functions | `SupabaseService.swift:8-10` builds `auth/v1`, `rest/v1`, `functions/v1` from the project URL |
| 54321 / 54322 / 54323 / 54324 | TCP | Supabase CLI **defaults** (Kong / API / Studio / Inbox) for a local stack. **These are not configured anywhere in this repository** — they apply only if you run `supabase start` | Supabase CLI convention, not repo-defined |

---

### 2. Installation and Setup

#### 2.1 Windows-side preflight (everything possible on this machine)

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\student-buy-sell-marketplace-app"
git status
git log --oneline -5
Get-ChildItem -Force
```

Confirm the expected layout: `Panthers Marketplace/`, `Panthers Marketplace.xcodeproj/`, `Panthers MarketplaceTests/`, `Panthers MarketplaceUITests/`, `supabase/`, `README.md`, `project-metadata.json`, `.gitignore`, `.vscode/`.

Then confirm the secret-handling problem described in §2.5 (read-only inspection; do not echo the values):

```powershell
git ls-files | Select-String -Pattern "\.env$"
Get-Content -LiteralPath ".\Panthers Marketplace\App.env" | ForEach-Object { ($_ -split "=")[0] }
```

The second command prints **key names only** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`) — it does not print the values. Do not paste the values into chat, tickets, or logs.

#### 2.2 macOS-side: open the project and resolve packages (the real install step)

```bash
cd "/path/to/student-buy-sell-marketplace-app"
open "Panthers Marketplace.xcodeproj"
```

On first open, Xcode resolves the Swift Package dependency (`supabase-swift` ≥ 2.5.1) from GitHub. This needs network access; expect a one-time multi-minute fetch. The shared scheme `Panthers Marketplace` is checked in under `Panthers Marketplace.xcodeproj/xcshareddata/xcschemes/`, so it is shared with the team and appears in the scheme selector.

**Xcode 16 note:** the project uses `PBXFileSystemSynchronizedRootGroup` (Xcode 16 "synchronized folders") for `Panthers Marketplace/`, `Panthers MarketplaceTests/` and `Panthers MarketplaceUITests/`. That is why the `Sources` and `Resources` build phases in `project.pbxproj` are empty: Xcode 16+ auto-adds every file in those folders to the matching target, including `App.env` as a bundled resource. On Xcode 15 or earlier the project will not open correctly, and `App.env` will not be bundled.

#### 2.3 macOS-side: verify the Supabase configuration

`Panthers Marketplace/App.env` must contain exactly these three keys (the values are the ones from the upstream Supabase project):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_PROJECT_REF=<project ref>
```

The file is read at runtime by `Services/SupabaseService.swift:12-23` via `Bundle.main.path(forResource: "App.env", ofType: nil)`, and both missing-file and missing-key cases call `fatalError` (lines 13 and 68). There is no build-time configuration step and no `.xcconfig`; the file is read directly from the app bundle.

**Do not replace the committed `App.env` with placeholders** — the app will `fatalError` on a missing key, and the placeholder values will simply fail to authenticate. If you are pointing at your own Supabase project, supply your own project values locally and keep the upstream file untouched in git history (see §2.5).

#### 2.4 Optional: local Supabase stack (not required for the app to run)

The repo contains `supabase/config.toml` describing one Edge Function, `enforce-fiu-domain` (Deno entrypoint `./functions/enforce-fiu-domain/index.ts`, `verify_jwt = true`, import map `./functions/enforce-fiu-domain/deno.json`).

**Two gaps to be aware of before you try this:**

- `supabase/functions/` **does not exist** in this checkout, so the function source referenced by `config.toml` is missing. `supabase functions serve` will not find the entrypoint until you restore or write it.
- `supabase/migrations/` **does not exist** either — there is no SQL schema in the repository. The tables the app queries (`profiles`, `posts`, `messages`, `threads`, `saved_items` — see `SupabaseService.swift`) and the `profile_picture` storage bucket must already exist in the hosted project; a fresh local stack will have neither.

With Docker installed, a local stack would be:

```bash
supabase start
supabase status
```

The CLI version used here was `v2.53.6` (`supabase/.temp/cli-latest`); the pinned service versions recorded in `supabase/.temp/` are GoTrue `v2.180.0`, Postgres `17.6.1.021`, REST `v13.0.5`, Storage `v1.27.6`.

#### 2.5 Security remediation — committed credentials (do this before sharing the repo)

Verified by `git ls-files`: **`Panthers Marketplace/App.env` is tracked in git**, even though `.gitignore:15-19` lists `App.env`, `.env`, `*.env`, `.env.*`, `*.env.*`. The ignore rules are defeated because the file was already tracked. The file contains the three Supabase keys listed in §2.3.

Consequences and remediation, in order:

1. Treat the current `SUPABASE_ANON_KEY` and project reference as **public**. The anon key is designed to be client-visible, but the project URL/ref are still infrastructure details and the key may have broader RLS coverage than intended.
2. Rotate the anon key in the Supabase dashboard, and review Row Level Security policies on `profiles`, `posts`, `messages`, `threads`, `saved_items` and the `profile_picture` bucket.
3. Un-track the file without deleting it from disk:
   ```bash
   git rm --cached "Panthers Marketplace/App.env"
   ```
   and keep the ignore rule in place. Note this changes the working tree; the file stays present so the app keeps building.
4. History rewriting (`git filter-repo`) is a separate, optional, history-rewriting operation — out of scope for this document and not performed here.
5. In code, `App.env` must remain a **bundled resource** for the app to find it. If you later untrack and ignore it, you still need to add it to the target's *Copy Bundle Resources* phase. Because the project uses Xcode 16 synchronized folders, a file that is ignored by git but present on disk is still picked up by Xcode — which is exactly the configuration that makes the untracked-but-bundled setup work.

**Files not part of the app target (verified, worth knowing before you "fix" them):** `supabase/Environment.swift` and `supabase/SupabaseConfig.swift` sit outside the synchronized folder `Panthers Marketplace/` and appear nowhere in `project.pbxproj` — they are not compiled into any target. A grep for `SupabaseConfig` and `Environment.value` across every `.swift` file under `Panthers Marketplace/` returns **no matches**, i.e. the running app does not use them; it reads `App.env` directly through `SupabaseService`. Likewise the three stray fragments at the repository root — `AuthViewModel.swift`, `ProfileView.swift`, `ProfileViewModel.swift` — are not in any target and are not compilable standalone (`AuthViewModel.swift` at the root is only a `signOut()`/`clearWebCaches()` fragment). The real versions are `Panthers Marketplace/ViewModels/AuthViewModel.swift`, `Panthers Marketplace/ViewModels/ProfileViewModel.swift` and `Panthers Marketplace/Views/ProfileView.swift`.

#### 2.6 Optional: VS Code users

`.vscode/settings.json` configures the **Sweetpad** extension (`sweetpad: build` on save, `swift.format` with `--in-place`). It is editor tooling only and is not required to build the app; `sweetpad.format.args` points at a `.vscode/.swift-format` file that is **not present** in the repository, so the format-on-save task will fail until you supply one.

---

### 3. Launch the Complete Project

#### 3.1 Entry point chain (read from the sources)

| Level | File | Detail |
|---|---|---|
| App entry | `Panthers Marketplace/Panthers_MarketplaceApp.swift:10-16` | `@main struct Panthers_MarketplaceApp: App` → `WindowGroup { RootView() }` |
| Root view | `Panthers Marketplace/ViewModels/RootView.swift:16-30` | `Group { if authVM.isLoggedIn { FeedView() } else { LoginView() } }` with `AuthViewModel`, `ProfileViewModel`, `ChatViewModel` injected as `@EnvironmentObject` |
| Unauthenticated path | `Panthers Marketplace/Views/LoginView.swift:32,71` | "FIU email (@fiu.edu)" text field, a **Sign In** button, and a `NavigationLink` to `SignUpView()` |
| Authenticated path | `Panthers Marketplace/Views/FeedView.swift:10-35` | `NavigationStack` feed with `FilterTag` / `FilterSheetView` helpers |
| Not the root | `Panthers Marketplace/ContentView.swift:11-241` | A standalone "Database Connection Test" screen (calls `SupabaseService.shared.testConnection()` and `fetchUsers()`). It is referenced only by its own `#Preview` at line 240 and is **not** wired into `RootView` |
| Backend client | `Panthers Marketplace/Services/SupabaseService.swift` (1121 lines) | Singleton `SupabaseClient`; ~35 methods covering auth, posts, saved items, threads/messages, storage upload and signed URLs, and realtime message subscription |

The root-level `AuthViewModel.swift` in the repository is a stray fragment, **not** the entry point, even though `project-metadata.json` lists `"entry": "AuthViewModel.swift"`. The real entry point is `Panthers_MarketplaceApp.swift`.

#### 3.2 Run from Xcode (macOS)

1. Open `Panthers Marketplace.xcodeproj`.
2. Select the shared scheme **Panthers Marketplace** and a destination: an iOS 18.2+ simulator, or a connected device.
3. Press **Cmd+R**.

Expected first-run behaviour: the app starts on `LoginView` (not logged in), and the console prints `✅ Initialized Supabase client with configuration from App.env file (emitLocalSessionAsInitialSession = true)` (`SupabaseService.swift:54`). If instead you see `❌ Missing .env file in bundle` or `❌ Missing <KEY> in .env file`, the `App.env` resource is not in the app bundle — re-check §2.2 (Xcode 16 synchronized folders) and §2.5 step 5.

#### 3.3 Run from the command line (macOS)

```bash
cd "/path/to/student-buy-sell-marketplace-app"
xcodebuild -list -project "Panthers Marketplace.xcodeproj"
xcodebuild -project "Panthers Marketplace.xcodeproj" \
  -scheme "Panthers Marketplace" \
  -destination 'platform=iOS Simulator,name=<Simulator Name>' \
  -configuration Debug \
  build
```

Replace `<Simulator Name>` with one of the destinations reported by `xcodebuild -showdestinations -project "Panthers Marketplace.xcodeproj"`. Launching the built `.app` directly with `simctl` is possible but is not the documented path; Xcode's Run action is.

#### 3.4 Reaching the main features

- **Sign-up gate:** `ViewModels/AuthViewModel.swift:64-66` and `:96-98` reject any address that does not end in `@fiu.edu` ("Use your @fiu.edu email."), and `:217-218` implements the check as `email.lowercased().hasSuffix("@fiu.edu")`. This is a **client-side** check only; the server-side counterpart is the `enforce-fiu-domain` Edge Function, whose source is missing from this repository (§2.4).
- **Profile creation:** `AuthViewModel.createProfile(userId:fullName:email:)` inserts a row into `profiles` right after sign-up (`:158-...`), deriving a username from the local part of the email.
- **Storage:** avatars are uploaded to the `profile_picture` bucket and served through signed URLs (`getSignedURL(bucket: "profile_picture", ...)`, default expiry 3600 s).

---

### 4. Test the Project

**There is no external test framework and no CI workflow in the repository.** The Xcode project ships two test targets, and the shared scheme's `TestAction` includes both. No test has been executed here — Xcode and a Simulator are unavailable on this machine.

#### 4.1 What the test targets actually contain

| Target | File | Framework | Content |
|---|---|---|---|
| `Panthers MarketplaceTests` | `Panthers MarketplaceTests/Panthers_MarketplaceTests.swift:11-15` | `import Testing` (Swift Testing, Xcode 16+) | One `@Test func example() async throws` with an empty body and the comment "Write your test here" — a **placeholder with no assertions** |
| `Panthers MarketplaceUITests` | `Panthers MarketplaceUITests/Panthers_MarketplaceUITestsLaunchTests.swift:20-31` | XCTest | `testLaunch()` launches the app via `XCUIApplication()` and attaches a screenshot named "Launch Screen" with `.keepAlways` lifetime |
| `Panthers MarketplaceUITests` | `Panthers MarketplaceUITests/Panthers_MarketplaceUITests.swift` | XCTest | Present in the target; inspect it before relying on it |

**Honest assessment:** the unit test target asserts nothing, and the only UI test is a launch smoke test. A green test run therefore proves *the app launches*, not that the marketplace works.

#### 4.2 Running the tests (macOS)

```bash
xcodebuild -project "Panthers Marketplace.xcodeproj" \
  -scheme "Panthers Marketplace" \
  -destination 'platform=iOS Simulator,name=<Simulator Name>' \
  test
```

or, in Xcode: select the scheme → **Product → Test** (Cmd+U). The scheme's `TestAction` is set to `shouldAutocreateTestPlan = "YES"` and marks both test bundles `skipped = "NO"`, `parallelizable = "YES"`.

Note that the UI test launches the real app, which initialises `SupabaseService` and therefore **requires valid `App.env` credentials and network access**; without them the app hits a `fatalError` during launch and the UI test fails.

#### 4.3 Manual end-to-end acceptance path (interactive, macOS)

| # | Step | Expected observable result | Status |
|---|---|---|---|
| 1 | Build the `Panthers Marketplace` scheme for a simulator | Build succeeds (no test/build was run here) | Not run |
| 2 | Launch the app | `LoginView` appears with an "FIU email (@fiu.edu)" field; console prints the Supabase init line | Not run |
| 3 | Sign in with a non-FIU address | Inline error "Use your @fiu.edu email." (`AuthViewModel.swift:65`) | Not run |
| 4 | Sign up with an `@fiu.edu` address | Account created; a `profiles` row is inserted; app switches to `FeedView` (`RootView.swift:18-22`) | Not run |
| 5 | Browse the feed | Listings render from the `posts` table (`SupabaseService.fetchPosts`) | Not run |
| 6 | Filter / sort / search | `FilterSheetView`, `FilterTag`, and `searchPosts(query:filters:)` work against `posts` | Not run |
| 7 | Save / unsave an item | `saved_items` rows created and removed (`savePost` / `unsavePost` / `isPostSaved`) | Not run |
| 8 | Start a chat on a listing | A `threads` row is created (`createThread(postId:buyerId:sellerId:)`), messages are written to `messages` | Not run |
| 9 | Receive a message in the app | Realtime subscription delivers the message (`subscribeToMessages(threadId:onMessage:)`) | Not run |
| 10 | Upload a profile picture | Image lands in the `profile_picture` bucket; the avatar renders via a signed URL | Not run |
| 11 | Open the profile screen | `ProfileView` shows profile and `UserStats` (listed items, saved items, chats, completed transactions, total earnings) | Not run |
| 12 | Run the test suite (Cmd+U) | Both test bundles execute; the unit test is a no-op and the UI test attaches a screenshot | Not run |

#### 4.4 Observability that does exist

- `SupabaseService.testConnection()` returns `Bool` and is surfaced by the `ContentView` "Database Connection Test" screen as `✅ Connected to Supabase!` / `❌ Connection failed` (`ContentView.swift:203-205`).
- `SupabaseService` prints diagnostics to the console (e.g. `🔄 Testing connection to Supabase...`, `✅ Loaded stats for user: ...`).
- Because `ContentView` is not part of the navigation graph, exercising it requires temporarily setting it as the root view in `Panthers_MarketplaceApp.swift` — that is a code change, not a build setting.

---

### 5. Troubleshooting

| Symptom | Likely cause | Action | Verified? |
|---|---|---|---|
| Xcode refuses to open the project / "project format is not supported" | `objectVersion = 77` requires Xcode 16+ | Install Xcode 16 or later; on Xcode 15 the synchronized-folder groups cannot be read | Verified from `project.pbxproj`; not reproduced |
| `❌ Missing .env file in bundle` at launch | `App.env` is not in the app bundle (e.g. project opened in Xcode 15, or the file was removed from the folder) | Confirm `Panthers Marketplace/App.env` exists next to `Panthers_MarketplaceApp.swift` and that Xcode is 16+; the synchronized group should bundle it automatically | Verified from `SupabaseService.swift:12-14` |
| `❌ Missing SUPABASE_URL in .env file` | The key is absent or empty in `App.env` (`getEnvValue` treats an empty value as missing, `SupabaseService.swift:61-67`) | Re-add the key; keep the `KEY=value` format with no spaces around `=` | Verified from the source |
| `❌ Invalid Supabase URL in .env file` | `SUPABASE_URL` is not a parseable URL | Use the full `https://<ref>.supabase.co` form | Verified from `SupabaseService.swift:25-27` |
| Package resolution fails / "supabase-swift" not found | No network access to GitHub, or a proxy blocks it | Check connectivity to `github.com`; the package reference is `https://github.com/supabase-community/supabase-swift.git` (minimumVersion 2.5.1) and `Package.resolved` is git-ignored, so it must be re-resolved every fresh clone | Verified from `project.pbxproj` and `.gitignore:25` |
| Build error in `SupabaseService` about `AuthClient.Configuration` | `supabase-swift` resolved to a version older than the API the code uses | Pin the package to ≥ 2.5.1 in Xcode (File → Packages → Update to Latest) | Not reproduced |
| Sign-up is rejected with "Use your @fiu.edu email." even for a valid address | The check is `hasSuffix("@fiu.edu")` on the lowercased address | Use an address whose domain is exactly `fiu.edu` (e.g. `user@fiu.edu`); student subdomain addresses like `user@my.fiu.edu` will not match | Verified from `AuthViewModel.swift:217-218` |
| Sign-up succeeds but the profile is missing | The `profiles` insert happens right after auth; a failure surfaces as an error string | Check the `profiles` table in the Supabase dashboard and the RLS policies | Verified from the code path; not reproduced |
| `supabase start` fails or the function is missing | `supabase/functions/enforce-fiu-domain/` is not in the repository, and `supabase/migrations/` is absent | Restore the function source, or accept that the local stack has no schema and point the app at the hosted project instead | Verified: both directories are absent |
| UI test fails at launch while the app runs fine in Xcode | The UI test relaunches the app in a clean state, so it hits the `fatalError` path in `SupabaseService.init()` | Ensure `App.env` is bundled and the credentials are valid; the test cannot run against a misconfigured bundle | Verified from `SupabaseService.swift:9-27` |
| `xcodebuild` reports "xcodebuild: error: The workspace does not contain a scheme named ..." | Scheme name contains a space and must be quoted | Use `-scheme "Panthers Marketplace"`; list schemes with `xcodebuild -list -project "Panthers Marketplace.xcodeproj"` | Verified from the scheme file name |
| Swift-format task fails in VS Code | `.vscode/.swift-format` is referenced but absent from the repository | Create the file or remove the `sweetpad.format.args` setting | Verified from `.vscode/settings.json` |
| App Store / device build fails with a signing error | No `DEVELOPMENT_TEAM` is set in the project | Select your team in Signing & Capabilities, or use the simulator | Verified from the build settings |

---

### 6. Verification Checklist

Every item below is **unchecked** because no build, launch, or test was performed — the required toolchain (macOS + Xcode 16 + iOS 18.2 SDK) is not available on the machine where this document was produced. Tick a box only after personally observing the result.

- [ ] macOS with Xcode 16 or later is installed and the active developer directory is set (`xcode-select -p`).
- [ ] `xcodebuild -version` reports Xcode 16+.
- [ ] `xcodebuild -list -project "Panthers Marketplace.xcodeproj"` shows the `Panthers Marketplace` scheme and both test targets.
- [ ] The Swift package `supabase-swift` (≥ 2.5.1) resolved successfully.
- [ ] `Panthers Marketplace/App.env` exists and contains the three keys `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`.
- [ ] The app launches and the console prints `✅ Initialized Supabase client with configuration from App.env file`.
- [ ] `LoginView` appears with the "FIU email (@fiu.edu)" field.
- [ ] A non-`@fiu.edu` address is rejected with "Use your @fiu.edu email."
- [ ] A `@fiu.edu` address signs up successfully and a `profiles` row is created.
- [ ] `FeedView` renders listings from the `posts` table.
- [ ] Save/unsave writes and removes `saved_items` rows.
- [ ] A chat creates a `threads` row and a message appears in `messages`.
- [ ] A realtime message arrives while the app is in the foreground.
- [ ] A profile picture uploads to the `profile_picture` bucket and renders through a signed URL.
- [ ] `xcodebuild ... test` completes with both test bundles running (noting the unit test asserts nothing).
- [ ] The `App.env` committed-secret risk from §2.5 has been acknowledged and the anon key rotated.
- [ ] `git ls-files` no longer lists `Panthers Marketplace/App.env` (after `git rm --cached`).

---

#### Known limitations to state honestly

- **This is an iOS-only native app.** There is no Android target, no Flutter/Dart code, and no Firebase configuration, despite `project-metadata.json` claiming "Flutter; Firebase Storage". The real entry point is `Panthers Marketplace/Panthers_MarketplaceApp.swift`, not the root-level `AuthViewModel.swift` the metadata names.
- **Nothing here was built, run, or tested.** This document was written on Windows, where no Xcode, no iOS Simulator, and no `xcodebuild` exist. Every command in §2.2–§3.3 and §4.2 is transcribed from the repository's own conventions and is unverified in execution.
- **The macOS + Xcode 16 requirement is a hard blocker**, and it is compounded: `objectVersion = 77`, the Swift Testing-based unit target, the Xcode 16 synchronized-folder groups, and the iOS 18.2 deployment target all pin the toolchain to a recent Xcode.
- **The Supabase backend is not reproducible from this repository.** There is no `supabase/migrations/` and no `supabase/functions/enforce-fiu-domain/` source, so neither the database schema nor the server-side FIU-domain enforcement can be recreated locally. A hosted Supabase project is a hard prerequisite.
- **`supabase start` also needs Docker, which is not installed here**, so the optional local stack cannot be exercised on this machine even if the missing files were restored.
- **A committed-secret risk exists and is unresolved.** `Panthers Marketplace/App.env` is tracked in git despite the `.gitignore` rules that should exclude it. The rotation and `git rm --cached` steps in §2.5 have **not** been performed; this document does not modify the repository.
- **The test suite is essentially a smoke test.** One empty Swift Testing placeholder and one launch-and-screenshot UI test provide no coverage of the marketplace's actual behaviour.
- **The repository carries stray, non-compiling fragments** (root-level `AuthViewModel.swift`, `ProfileView.swift`, `ProfileViewModel.swift`; `supabase/Environment.swift`, `supabase/SupabaseConfig.swift`) that are not part of any target. Editing them has no effect on the built app.
- **`Package.resolved` is git-ignored**, so every fresh clone pays the full SPM resolution cost and can drift to a different `supabase-swift` version.

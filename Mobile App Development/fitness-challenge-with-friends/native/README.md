# Rally (SwiftUI)

The native iOS app: SwiftUI throughout, talking to the same Node server in `../server`. Same bundle
id as the Expo build (`com.jean.fitnesschallenge`) and the same Keychain entry, so installing it over
the Expo build keeps you signed in. The Expo app in `../app` and `../src` is untouched.

Requires iOS 26 and Xcode 26 with the Metal Toolchain (`xcodebuild -downloadComponent MetalToolchain`).

```
open native/Rally.xcodeproj      # or:
xcodebuild -project native/Rally.xcodeproj -scheme Rally -sdk iphonesimulator -derivedDataPath native/build
```

The server address is the `RALLY_API_URL` build setting (default `http://Jeans-MacBook-Neo.local:8787`).
`npm run api` must be running.

## Layout

- `Model/` JSON types, the catalog and copy (ports of `shared/`), and `API.swift` (session, Keychain,
  10 s timeouts, one retry on reads, same-day offline cache, refresh after every write).
- `Design/` system colors plus Rally red (`Theme.swift`), components, the Metal water shaders
  (`Water.metal`) and their SwiftUI wrappers (`Water.swift`), and the RealityKit trophy.
- `Screens/` one file per area. `Services/` Messages, contacts, share sheet, reminders, Face ID, and
  Apple Intelligence (Foundation Models).

## Motion

Everything moves on fluid springs (`Motion`). Metal shaders add the water: a ripple from the touch
point on every button, chip and card; liquid progress bars that pour and slosh; water rising in the
check-in and streak circles; pool light across the backdrop; content settling like a surface as it
arrives. RealityKit draws a 3D trophy on a finished challenge with a winner. All of it stands still
with Reduce Motion.

## Appearance

Settings > Appearance: Match iPhone, Light or Dark. Colors are UIKit semantic colors; Rally red keeps
its own light, dark and Increase Contrast values.

## Debug-only helpers

`xcrun simctl launch booted com.jean.fitnesschallenge -RallyDemo YES` opens a page of the water and 3D
pieces; `-RallyWelcome YES` shows the signed-out welcome without signing out.

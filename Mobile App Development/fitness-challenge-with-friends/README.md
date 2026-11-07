# Rally

A friend invites you to a challenge by text. You see the challenge and the consequence before you
make an account. You log one thing a day. The app keeps score.

Built to the plan in the build prompt: three tabs (Home, Check-in, Me), the challenge as one
screen, a four screen create flow, invite links, and five house challenges.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript, Expo Router.
- A zero dependency Node API in `server/` with a JSON file for storage. Node runs the
  TypeScript directly, so there is no build step.
- Lexend everywhere, one red accent, no other libraries for UI, motion or charts.

## Running it

Two processes. Start the API first.

```bash
npm run api
```

```bash
npm start
```

Then press `w` for the browser, `i` for the iOS simulator, or scan the QR code with Expo Go.

The app finds the API on port 8787 of whatever host serves the app, so a phone on the same wifi
works with no configuration. To point it somewhere else, set `EXPO_PUBLIC_API_URL`. Invite links
are built the same way; override with `EXPO_PUBLIC_INVITE_URL` once it is hosted somewhere real.

## Demo data

Sign up in the app first, then:

```bash
npm run seed
```

That gives the most recent signup a crew (Maria, Keisha, Tom), a live class challenge with an
agreed consequence, a steps challenge with a consequence waiting on a vote, a finished challenge
you won, and a few days of history so the streak and the charts have something in them.
`npm run seed -- Dana` targets a person by name. Data lives in `server/data/db.json`; delete it
to start over.

The seeded finished challenge, "Walk it off", carries the last name consequence and is won by the
seeded user, so the winner's screen can be tried without waiting a week for a challenge to end. The
demo user signs in on a fresh install with phone 555 010 0001 and PIN 2580 (development data only).

## Last name consequence

One of the suggested consequences is "Gets a new last name from the winner for a week", and any
consequence that mentions a last name works the same way. When the challenge ends, the winner sees a
"Pick a new last name" card with a field for each person on the hook, and gives them any last name
of up to 20 letters. It lasts seven days, then the name goes back by itself.

- The new name is applied when the server loads a user, so every place a name is printed shows it
  (standings, crew, "Maria won this one"). The stored name is never changed; `save()` writes the real
  one back.
- The person it lands on sees a notice on Me and can change it back from Settings, and cannot edit
  their name there while it is in effect. Each person on the hook is renamed once per challenge.

## Inviting friends

An invite is a link plus an eight character code (`K7M2-QX9R`, no look-alike characters, typed in any
case). Someone who has the app but never tapped a link uses "Have an invite?" on Welcome or on Join a
challenge and pastes the whole text or types the code. Share another way opens the system share sheet
for anything that is not Messages.

For friends who are not on your Wi-Fi, three things have to be true, and none of them can be done from
inside the app:

1. The API is reachable from the internet at an HTTPS address, and the app was built with
   `EXPO_PUBLIC_API_URL` set to it. That address is baked in at build time.
2. `EXPO_PUBLIC_INVITE_URL` is the same address, so the link in the text opens the invite page (a
   custom-scheme link like `fitchallenge://` is not tappable in Messages).
3. `INSTALL_URL` (for the API process) is the TestFlight or App Store link, so the invite page can
   send someone who has not installed the app to get it.

## How scoring works

Each period (a day or a week) earns credit up to the target, so five gym sessions in one week
cannot cover a week you missed. Standings rank on total credit across the challenge, which is why
a card can say "2 of 3 this week" while the standings say "7 of 12".

- Threshold challenges (per day, per week): everyone who hits the target finishes. The lowest who
  does not is on the hook.
- Race challenges (a total, like the 20 miles house challenge): first to the target wins.
- Session challenges take one log a day. Numeric ones (steps, miles) add up across the day.
- House challenges run on each member's own window, starting the day they join, and have no
  consequence and no commissioner.

## Layout

```
app/            screens, one file per route (Expo Router)
src/            design system (theme, ui, inputs, motion) and shared screen pieces
shared/         types, challenge wording and copy used by both the app and the server
server/         the API, its storage, and the seed script
```

`shared/` is imported by both sides, so the plain words sentence on a challenge card and the one
in an invite text come from the same function.

## Apple platform features

Built from Apple's own documentation (Adopting Liquid Glass, the Human Interface Guidelines for Dark
Mode, Color, Materials and Accessibility, and the Core experiences and Data management overviews),
and checked on an iOS 26.5 simulator.

**Liquid Glass.** `src/glass.tsx` uses the real `UIGlassEffect` through `expo-glass-effect`, which
runs in Expo Go. Apple's Materials guidance says glass belongs on the controls and navigation layer
and that app backgrounds and content use standard materials, so glass is on the tab bar, sheets and
toolbar buttons only; cards and callouts are plain surfaces. It falls back to a system blur on older
iOS, and to a solid surface under Reduce Transparency. Two gotchas that cost real time: opacity on a
glass view or any parent of one switches the effect off for good (`Enter` takes `fade={false}`
around glass), and it also disappears when its screen is detached by a push, so `Glass` remounts
the native view when its screen regains focus.

**Dark Mode.** The app follows the system appearance and offers no switch of its own, which is
Apple's guidance; it changes live, including Auto at sunset. Every color in `src/theme.ts` is a
`DynamicColorIOS` defined for light, dark, and an Increase Contrast variant of each, so iOS resolves
it natively with no re-render. Screens use Apple's base and elevated backgrounds: the page is the
base, modal cards and sheets are the brighter elevated one. Concrete strings for SVG and gradients
come from `usePalette()` in `src/appearance.ts`.

**Color and contrast.** Apple's floor is 4.5:1 for text (7:1 preferred for small text) and 3:1 for
icons and graphics. The original palette failed it (secondary text 4.0:1, the white label on the red
button 4.24:1), so the tokens were re-derived against measured ratios. `npm run contrast` reads the
real values out of the source and checks every pair in all four contexts, including text sitting on
the strongest spot of the background glow. Red is split into `signal` (fills carrying a white label)
and `accent` (icons and graphics on the page, brighter in dark).

**Background.** `src/backdrop.tsx`: a quiet warm wash and a few hairline rings that echo the ripples
in the app icon, drawn with SVG radial gradients that fade to fully transparent, so no shape has an
edge. Glows sit away from the tab bar so controls never rest on colour, and the layer removes itself
under Increase Contrast and stops drifting under Reduce Motion.

**Text size.** Dynamic Type is supported to 200%, as Apple asks. Rows that no longer fit stack or wrap
(`useLargeText()`), the Home buttons scroll with the page instead of pinning, and tall sheets cap at
88% of the screen and scroll.

**Motion.** Everything that responds to a finger is a spring (`src/motion.tsx`), so it can be
interrupted and reversed mid-flight. The tab bar's selection lens slides between tabs and can be
dragged across; sheets follow the finger and fling away with the release velocity; the swipe card
carries a flick's speed through. Create and Log are native iOS modal cards with interactive
swipe-down. Reduce Motion is respected throughout.

**Native pieces.** SF Symbols with symbol effects (`expo-symbols`), haptics tied to real events
(selection, threshold, success, warning), Face ID (`expo-local-authentication`), and a layered app
icon in `assets/rally.icon` (Liquid Glass, dark, tinted and clear appearances, verified with Xcode's
`ictool` and `actool`).

**Data.** The session token and remembered account live in the Keychain (`src/secure.ts`,
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), migrated from AsyncStorage on first launch. Each screen's last
response is cached for the same calendar day so launches are instant and work offline.

**Sharing.** The API serves an invite page with Open Graph tags (`server/preview.ts`) so a link in
Messages shows a card with the challenge and its consequence, and serves the Apple App Site
Association file once `APPLE_TEAM_ID` is set. `app.config.ts` adds Associated Domains from
`INVITE_DOMAIN`. Together those are everything universal links need except a real domain.

**App Store.** Privacy manifest and export-compliance flag are in `app.json`.

### Apple Intelligence

Uses Apple's on-device model (Foundation Models, iOS 26) through a small local native module in
`modules/rally-intelligence`. Nothing is sent anywhere. It only works on iPhones with Apple
Intelligence (iPhone 15 Pro and newer) with it turned on. Everywhere else (older phones, web, Expo
Go) the screens look exactly as they did before.

- **Crew recap**: on a challenge with at least two people, one or two sentences about where you
  stand, written from the standings. It is cached per set of standings while the app is open.
- **Consequence ideas**: "Suggest more" under the consequence chips asks for three fresh ideas
  for this challenge. They go through the same no-money filter as anything typed.
- **Writing Tools**: the text fields are standard iOS fields, so proofread and rewrite are already
  in the edit menu. Genmoji is left out because challenge names and consequences are plain text on
  the server and in the invite texts, so a Genmoji would not survive the trip.

The simulator uses the Mac's model, so Apple Intelligence has to be on in the Mac's System
Settings to try these there. Adding the module needs a native rebuild (`pod install`, then build).

### Verified on the simulator

Light, dark, Increase Contrast, and Reduce Transparency (each alone and combined in dark); text at
the largest accessibility size; Face ID with enrolment, a rejected face, a matching face and the
fallback; a signed-out invite deep link. Simulator settings can be driven from the command line:
`xcrun simctl ui booted appearance dark|light`, `content_size accessibility-large` (relaunch after
changing it), `increase_contrast enabled`, and `xcrun simctl spawn booted notifyutil -p
com.apple.BiometricKit_Sim.pearl.match` (or `.nomatch`) once enrolled with `notifyutil -s
com.apple.BiometricKit.enrollmentChanged 1`.

### Needs a development build or an Apple account (not done here)

Native tabs (`expo-router/unstable-native-tabs`), Home Screen quick actions, widgets, Live
Activities, App Intents and Spotlight (all need native extension targets), Sign in with Apple, and
signing for TestFlight. A real universal-link handoff needs a signed build and an owned domain; the
app-side handling was checked with a deep link instead.

## Not built, on purpose

Community tab, athlete challenges, a mascot, tracker sync, rewards, photo proof, money, chat,
and comments are all out of scope for this version. See the notes at the end
of the build conversation for the smaller things that were deliberately left out.

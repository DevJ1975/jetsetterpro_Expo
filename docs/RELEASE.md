# Release guide — TestFlight + Google Play closed testing

Ship the beta to both stores with EAS. The app targets **Expo SDK 56**
(RN 0.85, New Architecture) with a dev-client + CNG (`ios/`, `android/` are
generated, git-ignored). Pro is unlocked for all beta testers
(`src/core/store/subscription.ts`), so no store IAP products are required.

> **Turnkey path:** after `eas login`, run `./scripts/eas-release.sh` — it checks
> auth and gates every remote/billable step behind a confirmation. The manual
> commands in this doc are exactly what that script runs.

## 0. Prerequisites (owner)

- Apple Developer Program membership + App Store Connect access.
- Google Play Console account.
- `npm i -g eas-cli && eas login` (Expo account owning `projectId`
  `42dd649a-31eb-4807-b2bd-113cdbe5b634`, owner `jamil.dev`).
- Backend deployed and secrets set — see `docs/backend/firebase.md`.
- A **Google Maps SDK for Android** key. It is a **build-time env** consumed by
  `app.config.ts` (injected into the `react-native-maps` plugin). For EAS
  **cloud** builds it must exist on the builder, so register it as an EAS project
  env (recommended — it is **not** in the build profiles today):
  `eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --scope project --environment production --environment preview`
  (or add it under `build.<profile>.env` in `eas.json`). Map display is free on
  the mobile SDK; iOS uses Apple Maps and needs no key. If the key is absent at
  build time, **Android builds still succeed but map tiles render blank**.

## 1. Keys & config already wired

- `eas.json` injects `EXPO_PUBLIC_API_BASE` + `EXPO_PUBLIC_AI_ENDPOINT` into the
  `preview` and `production` build profiles (public URLs only — never secrets).
  Verified against the deployed Cloud Functions: base
  `https://us-central1-jetsetter-pro.cloudfunctions.net` and AI endpoint
  `…/aiIris` (project `jetsetter-pro`, region `us-central1`).
- `app.json`: bundle id `com.trainovate.jetsetterpro` (both platforms), permission
  strings for location/camera/notifications/Face ID/calendar/microphone,
  `LSApplicationQueriesSchemes` for Uber/Lyft, `googleServicesFile` for FCM,
  Nunito embedded via the `expo-font` plugin.
- `production` profile: `autoIncrement: true`, `appVersionSource: "remote"`.

## 2. Native credentials

Run `eas credentials` once per platform (interactive — needs `eas login`). What
it provisions / asks for:

**iOS** (managed by EAS unless you bring your own):
- **Distribution certificate** — EAS can generate + store it.
- **Provisioning profile** for `com.trainovate.jetsetterpro` — EAS generates it
  against your Apple Team.
- **APNs key** (`.p8`) — for push notifications; EAS can create or you upload it.

**Android**:
- **Upload keystore** — EAS can generate + store it (Play App Signing then
  re-signs on Google's side).
- **FCM V1 service-account JSON** — for push delivery; upload it in
  `eas credentials`. (This is separate from the Play submit service account below.)

```bash
eas credentials
```

## 3. Device QA build first (both platforms)

```bash
eas build --profile preview --platform all
```

Install on a real iPhone + Android device and run the golden path:
onboard → add trip (scan a boarding pass) → Home flight card → Track flight →
Check in → Wallet pass → log an expense (scan receipt) → IRIS chat →
trigger a disruption push. Verify maps render, fonts are the rounded brand
face, and the tab bar blur looks right.

## 4. Production builds → stores

**iOS (TestFlight):**
```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios   # needs an App Store Connect API key
```
Then in App Store Connect: create the app record (first submit can create it),
add the build to a **TestFlight** internal/external group, answer the
export-compliance + privacy (location, notifications) questions.

**Android (Play closed testing):**
```bash
eas build --profile production --platform android
```
For the **first** Android release, download the `.aab` and upload it manually in
Play Console to create the app + a **Closed testing** track (Google requires the
first upload by hand). After that:
```bash
eas submit --profile production --platform android   # needs the Play service-account JSON
```
Add testers to the closed-testing track; complete the Data safety form.

### `submit.production` fields (fill the placeholders in `eas.json`)

The block is scaffolded for **both** platforms. eas.json can't hold comments, so
the values ship as empty strings — fill them before `eas submit`:

**ios**
- `ascAppId` — the App Store Connect app's numeric **Apple ID** (App Information →
  General; the first `eas submit` can create the app record).
- `appleTeamId` — your 10-character Apple Developer **Team ID**.
- App Store Connect **API key**: simplest is the **EAS-managed key** — leave the
  key fields out and `eas submit` creates/stores one interactively on first run.
  To pin it for CI instead, add `ascApiKeyPath` (path to the `.p8`), `ascApiKeyId`,
  and `ascApiKeyIssuerId`.

**android**
- `serviceAccountKeyPath` — path to the Google Play **service-account JSON**
  (Play Console → Users & permissions → a service account with the Release
  Manager role). Needed only for `eas submit`, i.e. from the 2nd release on.
- `track` — set to `internal` (Play **Internal testing**, up to 100 testers,
  fastest). Switch to `alpha` for the standard **Closed testing** track.

Keep real credential files **out of git** — point the `*Path` fields at a location
outside the repo (or a git-ignored path).

## 5. Store-deadline notes (as of 2026-07)

- **Android targetSdk:** SDK 56 prebuilds at target/compile API **35** —
  compliant for Play today. Any **update after Aug 31, 2026** must target API
  **36**: add `expo-build-properties` (~56.0.22) with
  `{ "android": { "compileSdkVersion": 36, "targetSdkVersion": 36 } }`, rebuild,
  and retest. (Closed testing itself is fine now.)
- **iOS:** App Store Connect uploads require the Xcode 26 / iOS 26 SDK — EAS
  default build images comply by construction on SDK 56.
- **Exact alarms:** the "remind me to leave" notification uses inexact Android
  scheduling by design (exact-alarm permission is policy-restricted to
  alarm/clock apps), so reminders may fire a few minutes early/late.

## 6. Pre-submit QA gate

```bash
npm run typecheck && npm test && npm run lint
```

All must be green. `npm test` covers the ported pure logic (Schengen calc,
split-flap reducer, seat-map/BCBP parsers, TSA heuristic, receipt OCR parse,
flight-window polling, disruption diff).

Also run `npx expo-doctor` for config/dependency sanity. Current status: **18/21**
checks pass; the config resolves cleanly (`npx expo config --type public`) with
the correct `projectId` / `owner` / bundle ids. The remaining three are benign:

- *Check Expo config schema* and *Validate packages against React Native
  Directory* — these fetch remote data and fail with a network/JSON error only
  when those hosts are unreachable (e.g. a locked-down CI/sandbox). They pass on
  a normal connection.
- *`@expo/config-plugins` should not be installed directly* — advisory only. It's
  a devDependency kept for config-plugin authoring (the `flight-activity` Apple
  target via `@bacons/apple-targets`); nothing in the app imports it, and it does
  not affect builds. Safe to leave.

# Release guide — TestFlight + Google Play closed testing

Ship the beta to both stores with EAS. The app targets **Expo SDK 56**
(RN 0.85, New Architecture) with a dev-client + CNG (`ios/`, `android/` are
generated, git-ignored). Pro is unlocked for all beta testers
(`src/core/store/subscription.ts`), so no store IAP products are required.

## 0. Prerequisites (owner)

- Apple Developer Program membership + App Store Connect access.
- Google Play Console account.
- `npm i -g eas-cli && eas login` (Expo account owning `projectId`
  `42dd649a-31eb-4807-b2bd-113cdbe5b634`, owner `jamil.dev`).
- Backend deployed and secrets set — see `docs/backend/firebase.md`.
- A **Google Maps SDK for Android** key → set `GOOGLE_MAPS_ANDROID_API_KEY`
  in `eas.json` build env (map display is free on the mobile SDK; iOS uses
  Apple Maps, no key). Without it Android builds succeed but map tiles are blank.

## 1. Keys & config already wired

- `eas.json` injects `EXPO_PUBLIC_API_BASE` + `EXPO_PUBLIC_AI_ENDPOINT` into the
  `preview` and `production` build profiles (public URLs only — never secrets).
- `app.json`: bundle id `com.trainovate.jetsetterpro` (both platforms), permission
  strings for location/camera/notifications/Face ID/calendar/microphone,
  `LSApplicationQueriesSchemes` for Uber/Lyft, `googleServicesFile` for FCM,
  Nunito embedded via the `expo-font` plugin.
- `production` profile: `autoIncrement: true`, `appVersionSource: "remote"`.

## 2. Native credentials

```bash
eas credentials
# iOS: let EAS manage the distribution cert + provisioning profile; upload/generate the APNs key.
# Android: generate the upload keystore; upload the FCM V1 service-account JSON (for push).
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

Fill the empty `submit.production` block in `eas.json` with your ASC API key /
Play service-account references to make `eas submit` non-interactive.

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

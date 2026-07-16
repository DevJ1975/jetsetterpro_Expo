# JetSetter Pro — React Native (Expo)

Cross-platform (iOS + Android) rewrite of the native SwiftUI **JetSetter Pro** app,
built on **Expo SDK 56** (React Native 0.85, React 19.2, New Architecture). A single
codebase reaching feature parity with the iOS app, on a **Firebase** backend
(Auth + Cloud Firestore, per-user `users/{uid}/trips` + `users/{uid}/expenses`).

## Status — iOS-parity, production beta

Full look + feature parity with the native iOS app, wired to live APIs for a
production beta on TestFlight + Google Play closed testing. Provider keys live
server-side in Firebase Cloud Functions; everything degrades gracefully when the
backend isn't deployed. See `docs/RELEASE.md` for the store runbook and
`docs/backend/firebase.md` for backend setup.

**Design system** — theme ported 1:1 from `JetsetterTheme.swift` (Nunito rounded
brand face, exact palette/radii, glass `.jetCard()` cards, blur tab bar) plus the
signature components: `SplitFlapText`, `AnimatedCounter`, `CardAppear`,
`ProgressRing`, `StarField`, `SuccessAnimation`, animated `Splash`.

**Live backend** (`functions/`) — `aiIris` (Anthropic), `flightData` (AeroDataBox
behind a provider adapter, shared Firestore cache), `translate` (Google Cloud
Translation via ADC), `duffelApi` (in-app flight booking, test mode),
`disruptionWatch` (scheduled status watcher → Expo push). On-device receipt OCR
(ML Kit); TSA-wait heuristic.

**Screens** — every iOS feature area: Home hero flight card, Flight Tracker +
map, split-flap Departure Board, In-Flight sensor mode (barometer + GPS),
Check-In flow, Disruption dashboard, Departure optimizer, Airport map wayfinding,
Ground transport, Apple-Wallet-style boarding passes, Itinerary + PDF417 scanner,
Intelligence history, Expenses (chart + scan + mileage) + provider export,
Currency donut/budget, Document Vault + Emergency Mode, Identity hub, Loyalty
catalog, Luggage detail, Packing, Journal share-card, Translator (live MT),
Essentials, Visa + Schengen calculator, Local experiences, in-app Booking
(Duffel), Rental, Carbon, Offline kit, paged Onboarding, full Settings + Loved
Ones, Paywall, About tour.

- ✅ Firebase anonymous-first auth + two-way Firestore sync; disruption push + flight-watch mirror
- ✅ Local-first Zustand stores (AsyncStorage-persisted)
- ✅ IRIS assistant — chat + hands-free voice + confirm-before-commit tools + learned profile
- ✅ Native targets: Flight Live Activity (`modules/`, `targets/`)
- ✅ Unit tests (`jest-expo`) — 172 tests over the ported core logic

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — see below
```

The Firebase **web config is client-public by design** and ships as defaults in
`src/core/firebase/config.ts`, so the app runs out-of-the-box (access is enforced by
Firestore Security Rules). Only set `EXPO_PUBLIC_FIREBASE_*` in `.env.local` to point
at your own/staging project, and `EXPO_PUBLIC_AI_ENDPOINT` to enable live IRIS.

This app uses **native modules** (secure-store, calendar, voice, dev-client, Live
Activities), so it runs in a **development build**, not Expo Go:

```bash
npx expo run:ios          # requires macOS + Xcode + CocoaPods
npx expo run:android      # requires Android SDK
# or start Metro against an already-installed dev build:
npx expo start --dev-client
```

EAS build profiles live in `eas.json` (`development` = dev-client). Native folders
(`ios/`, `android/`) are generated via `npx expo prebuild` (Continuous Native
Generation) — they are git-ignored.

## Scripts

```bash
npm test          # jest-expo unit tests
npm run typecheck # tsc --noEmit
npm run lint      # expo lint (eslint-config-expo)
```

## Architecture

```
app/            expo-router routes (root _layout, onboarding, (tabs)/, trip/[id], modals)
src/ui/         design system (theme tokens + components) — the uploaded JetSetter kit
src/types/      TypeScript models ported from the Swift Codable structs
src/features/   feature UI (common Screen/PremiumGate/ComingSoon, iris chat + voice, …)
src/core/
  firebase/     app config, anonymous-first auth, two-way Firestore sync (trips/expenses)
  store/        Zustand stores (travel, preferences, session, vault, wallet, iris, …)
  persistence/  AsyncStorage KV + expo-secure-store (Keychain) wrappers
  ai/           IRIS — personality, tools, agent loop, demo responses, Anthropic client
  api/          typed clients for keyless public APIs (Open-Meteo weather, FX, Overpass)
  data/         bundled datasets (countries/visa, phrasebook)
  services/     calendar, biometric gate, EU261/US-DOT compensation, live activity
  demo/         mock data + demo-mode seeding (mirrors the iOS MockDataService)
src/__tests__/  jest-expo unit tests for the core logic
functions/      Firebase Cloud Functions (the `aiIris` endpoint)
```

See `docs/backend/firebase.md` for backend setup and `docs/design-kit/` for the
original design-system README + example screen.

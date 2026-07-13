# JetSetter Pro — React Native (Expo)

Cross-platform (iOS + Android) rewrite of the native SwiftUI **JetSetter Pro** app,
built on **Expo SDK 56** (React Native 0.85, React 19.2, New Architecture). A single
codebase reaching feature parity with the iOS app, on a **Firebase** backend
(Auth + Cloud Firestore, per-user `users/{uid}/trips` + `users/{uid}/expenses`).

## Status

- ✅ Expo SDK 56 + expo-router (file-based) app shell, dark-first
- ✅ Design system from `src/ui` (the shipped JetSetter kit: tokens + components)
- ✅ 5-tab navigation: Home · Itinerary · IRIS · Expenses · More
- ✅ Onboarding → profile / home-airport / currency
- ✅ Firebase anonymous-first auth + two-way trips/expenses sync (Firestore)
- ✅ Local-first Zustand stores (AsyncStorage-persisted) + demo/mock mode
- ✅ IRIS assistant — chat + hands-free voice loop + staged, confirm-before-commit
  tools (check-in, log expense, add trip, packing, calendar); live via the `aiIris`
  Cloud Function (Anthropic key server-side), demo responses until it's deployed
- ✅ Feature modules: Document Vault (Keychain-backed), Wallet/passes, Loyalty,
  Luggage, Trip Journal, Translator phrasebook, Local Experiences (OpenStreetMap),
  Currency/FX, Weather, Visa & country essentials, Packing, Disruption/EU261
  compensation, Departure optimizer, In-Flight, Carbon
- ✅ Native targets: Flight Live Activity (`modules/`, `targets/` via apple-targets)
- ✅ Unit tests (`jest-expo`) for the core logic

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

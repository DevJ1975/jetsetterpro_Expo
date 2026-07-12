# JetSetter Pro — React Native (Expo)

Cross-platform (iOS + Android) rewrite of the native SwiftUI **JetSetter Pro** app,
built on **Expo SDK 54** (React Native 0.81, React 19, New Architecture). The goal is a
single codebase that reaches feature parity with the iOS app while reusing the same
**Supabase** backend (shared schema-v1: `public.trips` + `public.expenses`).

## Status — Phase 1: Foundation + core tabs

- ✅ Expo SDK 54 + expo-router (file-based) app shell, dark-first
- ✅ Design system from `src/ui` (the shipped JetSetter kit: tokens + 10 components)
- ✅ 5-tab navigation: Home · Itinerary · IRIS · Expenses · More
- ✅ Onboarding → profile/home-airport/currency
- ✅ Supabase anonymous-first auth + two-way trips/expenses sync
- ✅ Local-first store (AsyncStorage-persisted) + demo/mock mode
- ✅ Home dashboard, Itinerary (trips/items + calendar sync), Expenses (+ category breakdown)
- ⏳ Next phases: IRIS (Claude via Edge Function), native targets (Live Activities,
  PassKit, Siri, Watch), and the remaining ~30 feature modules

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
```

This app uses **native modules** (secure-store, calendar, dev-client), so it runs in a
**development build**, not Expo Go once native targets land. For the current phase:

```bash
npx expo start            # dev server (Expo Go works for the JS-only foundation)
# or a dev build:
npx expo run:ios          # requires macOS + Xcode
npx expo run:android      # requires Android SDK
```

EAS build profiles live in `eas.json` (`development` = dev-client). Native folders are
generated via `npx expo prebuild` (Continuous Native Generation) — they are git-ignored.

## Architecture

```
app/            expo-router routes (root layout, onboarding, (tabs)/, trip/[id], modals)
src/ui/         design system (theme tokens + components) — the uploaded JetSetter kit
src/types/      TypeScript models ported from the Swift Codable structs + Supabase schema
src/core/
  env.ts        env + config (Supabase URL/anon key)
  supabase/     client, anonymous-first auth, two-way sync (trips/expenses)
  store/        Zustand stores (preferences, travel, session, subscription)
  persistence/  AsyncStorage KV + expo-secure-store wrappers
  demo/         mock data + demo-mode seeding (mirrors the iOS MockDataService)
  api/          typed clients for keyless public APIs (Open-Meteo weather, FX)
src/features/   feature UI (common Screen/PremiumGate/ComingSoon, home, expenses, …)
```

See `docs/design-kit/` for the original design-system README + example screen.

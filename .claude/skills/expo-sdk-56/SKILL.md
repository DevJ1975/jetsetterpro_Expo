---
name: expo-sdk-56
description: >-
  Authoritative reference for Expo SDK 56 (React Native 0.85, React 19.2) as
  pinned in this repo. Use whenever working with Expo/React Native here —
  installing/upgrading any expo-* package, editing app.json config plugins,
  using expo-router / expo-file-system / expo-image / expo-secure-store,
  debugging native builds (prebuild, dev-client, EAS), Reanimated 4 / worklets,
  Hermes, or the New Architecture — and especially when SDK 56 behavior differs
  from older Expo (≤55) knowledge. Covers the exact version matrix, breaking
  changes, and the commands to verify versions against what is installed.
---

# Expo SDK 56 (this repo)

SDK 56 is **very new** — it postdates most training data, so default assumptions
about Expo/React Native are often wrong here. Trust this file and the installed
`node_modules` over prior knowledge. When unsure about a package version, **read
it from `package.json` / `node_modules`** — don't guess (see Verify, below).

## Core version matrix (pinned in this project)

| Package | Version | Notes |
|---|---|---|
| `expo` | 56.0.15 | SDK 56 |
| `react-native` | 0.85.3 | New Architecture is the default |
| `react` / `react-dom` | 19.2.3 | React 19 (Actions, `use`, ref-as-prop) |
| `expo-router` | 56.2.14 | Now **independent of react-navigation** |
| `react-native-reanimated` | 4.3.1 | v4 — New Arch only, needs worklets pkg |
| `react-native-worklets` | 0.8.3 | Worklets runtime split out of Reanimated |
| `react-native-screens` | 4.25.2 | |
| `react-native-safe-area-context` | 5.7.0 | |
| `react-native-gesture-handler` | 2.31.2 | |
| `expo-modules-core` | 56.0.20 | |
| `typescript` | ~6.0.3 | TS 6 |
| `jest-expo` / `babel-preset-expo` | ~56.x | |

Toolchain floors (SDK 56): **iOS/tvOS 16.4** (up from 15.1), macOS 13.4,
**Xcode 26.4**, Hermes **v1** default.

## The gotchas most likely to bite (SDK 56 vs ≤55)

Full detail + migration snippets in [breaking-changes.md](references/breaking-changes.md).
The short list:

- **`fetch` is now `expo/fetch` globally.** `globalThis.fetch` is Expo's
  streaming/WHATWG implementation, not the RN/Hermes one. Streaming bodies and
  `Request`/`Response` semantics differ from older RN.
- **`expo-file-system` `copy()` / `move()` are async** — they return Promises
  now. Un-awaited calls silently no-op-race. The old sync API moved to
  `expo-file-system/legacy`.
- **`expo-router` no longer ships react-navigation compatibility by default.**
  This repo still has `@react-navigation/*` installed and uses bottom-tabs; that
  works, but don't assume arbitrary react-navigation APIs bridge automatically.
- **Reanimated 4 requires the New Architecture** and the separate
  `react-native-worklets` package (already installed). Reanimated-3 patterns
  and `react-native-worklets-core` do **not** apply.
- **Hermes v1 is default.** Opt out with `useHermesV1: false` only if a
  dependency breaks. Bytecode diffing is on by default.
- **`@expo/vector-icons` is being superseded** by scoped
  `@react-native-vector-icons/*`. This repo maps the new names back to
  `@expo/vector-icons` in `jest.config.js`; keep imports on `@expo/vector-icons`
  for now.
- **New object-oriented Calendar / Contacts / MediaLibrary APIs are now stable**;
  the original function APIs are deprecated. iOS Widgets are stable (this repo
  uses `@bacons/apple-targets`).
- **Expo Go is not published for SDK 56.** You must use a **dev client**
  (`expo-dev-client` is installed). `npx expo start` targets the dev build, not
  Expo Go.

## Install / upgrade rule

Always pin expo-* and native deps through Expo, never a bare `npm install`:

```bash
npx expo install <pkg>          # picks the SDK-56-compatible version
npx expo install --check        # report deps that drift from the SDK
npx expo install --fix          # snap them back to SDK-56 versions
```

`npx expo install` reads `expo/bundledNativeModules.json` to choose versions.
A raw `npm i react-native-foo@latest` will pull a version built for a newer RN
and break the native build.

## Everyday commands

```bash
npx expo start            # dev server → opens in the dev client (not Expo Go)
npm run ios / android     # expo run:ios / run:android (local native build)
npx expo prebuild         # (re)generate ios/ + android/ from app.json + plugins
npx expo-doctor           # diagnose version/native mismatches — run after upgrades
npm run typecheck         # tsc --noEmit (TS 6)
npm run lint              # expo lint (eslint 9 flat config)
npm test                  # jest via jest-expo
```

Config lives in **`app.json`** (managed config plugins — see the `plugins`
array). There is no committed `ios/`/`android/` unless prebuilt; native config
is expressed through plugins, not hand-edited native files.

## Verify before you rely on a version

Don't trust memory for a package version — read it:

```bash
# one package
node -p "require('./node_modules/expo-image/package.json').version"

# the SDK's canonical pinned versions
node -p "Object.keys(require('./node_modules/expo/bundledNativeModules.json')).length"
cat node_modules/expo/bundledNativeModules.json   # SDK 56's blessed versions
```

If installed reality disagrees with this file, **installed reality wins** — and
update this skill (see below).

## Keeping this skill current

This file is pinned to the versions above. After `npx expo install --fix`, an
SDK bump, or a major dep upgrade, refresh the version matrix from
`package.json` + `node_modules` and re-check the changelog at
`https://expo.dev/changelog/sdk-56` (or the newer SDK's changelog). Deeper
migration notes: [breaking-changes.md](references/breaking-changes.md).

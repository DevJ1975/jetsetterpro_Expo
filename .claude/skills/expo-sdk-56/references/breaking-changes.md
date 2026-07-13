# Expo SDK 56 — breaking changes & migration detail

Load this when a task actually touches one of these areas. Source: Expo SDK 56
changelog (`https://expo.dev/changelog/sdk-56`) reconciled against the versions
installed in this repo.

## Platform / toolchain

- **iOS/tvOS minimum: 16.4** (was 15.1). macOS minimum 13.4.
- **Xcode 26.4** minimum for local/EAS iOS builds.
- **TypeScript 6.0.3** (this repo pins `~6.0.3`). Some TS 5-era `tsconfig`
  options are stricter or renamed under TS 6.
- **Hermes v1** is the default engine. Opt out per-app with `useHermesV1: false`
  in the app config if a native dep hasn't updated. Hermes bytecode diffing is
  on by default (smaller OTA/update deltas).
- **New Architecture (Fabric + TurboModules) is the default** in RN 0.85. Any
  library that is old-arch-only will not work without an interop shim.

## `fetch` → `expo/fetch` as the global

`globalThis.fetch` is now Expo's WHATWG-compliant implementation (supports
streaming request/response bodies), replacing the RN/Hermes networking `fetch`.

- Most code needs no change.
- If you depended on RN-specific `fetch` quirks (e.g. `text()` timing, blob
  handling, or the old `XMLHttpRequest`-backed behavior), test it.
- Streaming: you can now consume `response.body` as a stream.

## `expo-file-system`: `copy()` / `move()` are async

```ts
// SDK 56 (async — MUST await)
import { File } from 'expo-file-system';
await file.copy(dest);
await file.move(dest);

// Old synchronous behavior, if you truly need it:
import { copyAsync } from 'expo-file-system/legacy';
```

Un-awaited `copy`/`move` will race and appear to silently do nothing. Audit any
file operations that assumed synchronous completion.

## `expo-router` decoupled from react-navigation

- expo-router no longer guarantees drop-in compatibility with arbitrary
  `@react-navigation/*` APIs.
- **This repo** keeps `@react-navigation/native`, `@react-navigation/bottom-tabs`,
  and `@react-navigation/elements` installed and uses them through expo-router's
  layouts — that path is supported. Don't reach for lower-level react-navigation
  navigators/hooks expecting them to interop for free.
- `typedRoutes` experiment is enabled (`app.json` → `experiments.typedRoutes`),
  so route strings are type-checked; keep `.expo/types` in the tsconfig include.

## Reanimated 4 + worklets

- Reanimated **4.3.1** is **New-Architecture-only**.
- The worklet runtime is now the standalone **`react-native-worklets` 0.8.3**
  (installed), NOT `react-native-worklets-core` and NOT bundled inside
  Reanimated as in v3.
- `babel-preset-expo` wires the worklets Babel transform automatically — this
  repo's `babel.config.js` uses `presets: ['babel-preset-expo']` with no manual
  reanimated/worklets plugin, which is correct for SDK 56. Do **not** add the old
  `react-native-reanimated/plugin` manually; it will double-transform.

## Vector icons migration

- `@expo/vector-icons` (installed, `^15.0.3`) is being replaced upstream by
  scoped `@react-native-vector-icons/*` packages.
- `jest.config.js` already maps `react-native-vector-icons` → `@expo/vector-icons`
  so tests resolve either name. **Keep app imports on `@expo/vector-icons`** until
  a deliberate migration.

## Deprecated (still work, plan to migrate)

- Original **Calendar**, **Contacts**, **MediaLibrary** function APIs →
  new object-oriented APIs are now the stable path.
- iOS **Widgets** are stable (this repo uses `@bacons/apple-targets` for Apple
  extension targets).

## Build performance (informational)

- Precompiled iOS XCFrameworks cut ~1 min off clean builds.
- Experimental precompiled headers for Android codegen (large speedup).
- `expo start` / Metro bundling substantially faster than SDK ≤55.

## When native build breaks after a dep change

1. `npx expo install --fix` — realign every native dep to SDK 56.
2. `npx expo-doctor` — surfaces version mismatches and New-Arch incompatibilities.
3. `npx expo prebuild --clean` — regenerate native projects from `app.json`.
4. Confirm the offending lib supports **RN 0.85 + New Architecture**; old-arch-only
   libraries are the most common failure in SDK 56.

# Expo SDK 56 — build & configure (this repo)

Retrieval corpus for the **SDK56** agent. Grounded in the files actually
committed to this project. When disk disagrees with this doc, **disk wins** —
read `package.json`, `app.json`, `eas.json`, `babel.config.js`,
`metro.config.js`, `tsconfig.json`, and `node_modules` and trust those.

Source of record for anything not covered here: `https://expo.dev/changelog/sdk-56`
and `https://docs.expo.dev` (fetch live; do not answer versions from memory).

---

## 0. Golden rule — verify, never guess

SDK 56 postdates most training data. Before stating any version, flag, or API
shape, read it from disk:

```bash
node -p "require('./node_modules/expo/package.json').version"           # 56.0.x
node -p "require('./node_modules/react-native/package.json').version"   # 0.85.x
cat node_modules/expo/bundledNativeModules.json                         # SDK 56's blessed versions
npx expo config --type public                                          # fully-resolved app config (plugins applied)
```

---

## 1. Runtime / build model in this repo

- **Managed workflow, no committed `ios/` or `android/`.** Native projects are
  generated from `app.json` + config plugins via `npx expo prebuild`. Do not
  hand-edit native files as the primary source of truth — express native config
  through plugins so prebuild stays reproducible.
- **New Architecture (Fabric + TurboModules) is the default** (RN 0.85). Any
  old-arch-only native lib needs an interop shim or it won't link.
- **Hermes v1** is the default engine. Opt out only per-app with
  `useHermesV1: false` if a native dep hasn't caught up. Bytecode diffing is on
  → smaller OTA/update deltas.
- **Expo Go is NOT published for SDK 56.** `expo-dev-client` (`~56.0.22`) is
  installed and required. `npx expo start` targets the dev build, never Expo Go.

## 2. Installing / pinning dependencies

Never `npm install <native-lib>@latest`. Always route native + expo-* deps
through Expo so versions match the SDK's `bundledNativeModules.json`:

```bash
npx expo install <pkg>      # picks the SDK-56-compatible version
npx expo install --check    # report deps that drift from the SDK
npx expo install --fix      # snap them back to SDK-56 versions
npx expo-doctor             # diagnose native/version/New-Arch mismatches
```

Pure-JS libs (e.g. `zustand`, `@tanstack/react-query`, `firebase`) can use plain
`npm install` — they carry no native code.

## 3. Config plugins — `app.json` (this project's actual `plugins`)

Every plugin below is real in this repo; each injects native config at prebuild:

- `expo-router` — file-based routing entry (`main: "expo-router/entry"`).
- `expo-font`, `expo-image`, `expo-sharing`, `expo-status-bar`,
  `expo-web-browser` — bare string form, no options.
- `expo-splash-screen` — image/`resizeMode`/`backgroundColor` (`#06070D`).
- `expo-secure-store` — `faceIDPermission` (Document Vault unlock).
- `expo-calendar` — `calendarPermission` (add trips/flights).
- `expo-local-authentication` — `faceIDPermission`.
- `expo-speech-recognition` — `microphonePermission` +
  `speechRecognitionPermission` (IRIS hands-free voice).
- `expo-dev-client` — dev-client native shell.

Rules when editing this array:
- Any new native permission/capability is added as a **config plugin**, then
  `npx expo prebuild --clean` regenerates native. Editing Info.plist /
  AndroidManifest by hand is a last resort.
- Verify the resolved output with `npx expo config --type public` — it shows the
  plugins applied, which is what actually builds.
- `experiments.typedRoutes: true` is enabled → route strings are type-checked.
  Keep `.expo/types` in the tsconfig `include` (it already is).

## 4. Babel / Metro / TS wiring (do not "fix" these — they're correct for 56)

- **`babel.config.js`**: `presets: ['babel-preset-expo']` and nothing else.
  `babel-preset-expo` wires the **worklets** transform for Reanimated 4
  automatically. Do NOT add `react-native-reanimated/plugin` — it double-
  transforms and breaks worklets. (Reanimated 4.3.1 is New-Arch-only and uses
  the standalone `react-native-worklets` 0.8.3, not `-worklets-core`.)
- **`metro.config.js`**: `getDefaultConfig(__dirname)` +
  `config.resolver.sourceExts.push('cjs')`. The `.cjs` push is required so the
  Firebase JS SDK's CommonJS entrypoints (`firebase/auth` RN persistence)
  resolve. Don't remove it.
- **`tsconfig.json`**: extends `expo/tsconfig.base`, `strict: true`, `@/*` → repo
  root path alias (mirrored in `jest.config.js` `moduleNameMapper`). TS is
  `~6.0.3` (TS 6 — some TS 5-era options renamed/stricter).

## 5. EAS build profiles (`eas.json`)

- `cli.appVersionSource: "remote"` — version managed by EAS, not `app.json`.
- **development**: `developmentClient: true`, internal distribution, iOS
  simulator on. This is the profile that produces the dev client you run daily.
- **preview**: internal distribution, iOS simulator.
- **production**: `autoIncrement: true`.

Typical flow: `eas build --profile development --platform ios` → install dev
client → `npx expo start` connects to it.

## 6. Firebase / backend specifics (this repo)

- Uses the **Firebase JS SDK** (`firebase ^11.10.0`), NOT `@react-native-firebase`
  native modules — so no extra native config plugin is needed, and it runs in the
  dev client. The only build-time accommodation is the Metro `.cjs` resolver push.
- `functions/` is a **separate Cloud Functions package** with its own toolchain;
  it is excluded from the app's `tsconfig`, `jest`, and expo-doctor's RN
  directory check (`package.json` → `expo.doctor` excludes `flight-live-activity`).
- Deploy scripts: `npm run deploy:rules | deploy:functions | deploy:backend`.

## 7. Everyday commands

```bash
npx expo start            # dev server → dev client
npm run ios / android     # expo run:ios / run:android (local native build)
npx expo prebuild         # regenerate ios/ + android/ from app.json + plugins
npx expo prebuild --clean # nuke + regenerate (use after plugin/native changes)
npx expo-doctor           # run after any dep/SDK change
npm run typecheck         # tsc --noEmit (TS 6)
npm run lint              # expo lint (eslint 9 flat config)
npm test                  # jest via jest-expo
```

## 8. When a native build breaks after a dep change (recovery order)

1. `npx expo install --fix` — realign every native dep to SDK 56.
2. `npx expo-doctor` — surface version / New-Arch incompatibilities.
3. `npx expo prebuild --clean` — regenerate native projects from `app.json`.
4. Confirm the offending lib supports **RN 0.85 + New Architecture**; old-arch-
   only libraries are the single most common SDK 56 failure.

## 9. Known SDK 56 behavior changes to watch (see breaking-changes.md for full detail)

- `globalThis.fetch` is now **`expo/fetch`** (WHATWG/streaming), not RN/Hermes.
- `expo-file-system` `copy()`/`move()` are **async** — must `await`; sync API
  moved to `expo-file-system/legacy`.
- `expo-router` is **decoupled from react-navigation** — no free interop with
  arbitrary `@react-navigation/*` APIs.
- `@expo/vector-icons` is being superseded by `@react-native-vector-icons/*`;
  keep imports on `@expo/vector-icons` (jest maps both).
- New OO **Calendar / Contacts / MediaLibrary** APIs are the stable path; the
  original function APIs are deprecated.

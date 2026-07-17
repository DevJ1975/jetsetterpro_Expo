---
name: ship-both
description: >-
  Build AND submit production releases for BOTH iOS (App Store Connect /
  TestFlight) and Android (Google Play) at the same time, using two concurrent
  agents and the credentials stored in eas.json + the gitignored credentials/
  folder. Use when the user wants to ship, release, or submit the app to the
  stores — e.g. "ship both", "release to the stores", "submit iOS and Android",
  "push a new build to TestFlight and Play". Runs fully non-interactively via
  stored App Store Connect API key and Google Play service-account key — no
  Apple ID / 2FA prompts.
---

# ship-both — parallel iOS + Android build & submit

Fan out one **general-purpose agent per platform**, running at the same time. Each
agent runs a single EAS command that builds the production app and, on success,
submits it to the store — authenticated entirely by **stored credentials**, so
nothing prompts for a password or a 2FA code.

This repo's EAS project is `@trainovations/jetsetter-pro`. Builds/submits are
non-interactive; the Android signing keystore already lives on EAS, and iOS
signing credentials are generated on first run from the App Store Connect API key.

## 1. Preflight — verify stored credentials (fail fast, don't build blind)

Run these checks first. If ANY fails, print exactly what's missing + how to fix
it (see "Credential setup" below) and **stop** — do not start a build.

```bash
# a) logged into EAS
eas whoami

# b) eas.json submit config is present for both platforms
node -e '
  const s = require("./eas.json").submit?.production ?? {};
  const ios = s.ios ?? {}, and = s.android ?? {};
  const need = {
    "ios.ascApiKeyPath": ios.ascApiKeyPath,
    "ios.ascApiKeyId": ios.ascApiKeyId,
    "ios.ascApiKeyIssuerId": ios.ascApiKeyIssuerId,
    "ios.ascAppId": ios.ascAppId,
    "ios.appleTeamId": ios.appleTeamId,
    "android.serviceAccountKeyPath": and.serviceAccountKeyPath,
  };
  const missing = Object.entries(need).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) { console.error("MISSING eas.json submit fields:\n  " + missing.join("\n  ")); process.exit(1); }
  console.log("eas.json submit config OK");
'

# c) the actual key files exist on disk
node -e '
  const fs = require("fs");
  const s = require("./eas.json").submit.production;
  for (const p of [s.ios.ascApiKeyPath, s.android.serviceAccountKeyPath]) {
    if (!fs.existsSync(p)) { console.error("MISSING credential file: " + p); process.exit(1); }
  }
  console.log("credential files present");
'
```

## 2. Fan out — TWO agents, ONE message (so they run concurrently)

Spawn both with the Agent tool **in a single response** (two tool calls together).
Use `subagent_type: "general-purpose"`, `run_in_background: false`. Give each the
platform-specific prompt below. Do NOT run the builds yourself in the main thread —
the whole point is two parallel agents.

Shared instruction for each agent:
> You are shipping ONE platform of an Expo/EAS app (`@trainovations/jetsetter-pro`).
> Run the build+submit command below from the repo root. It is long-running
> (~10–25 min) — run it and wait for it to finish; do not background it. When it
> completes, return a compact structured result: `platform`, `buildStatus`,
> `buildUrl`, `submitStatus`, and (if anything failed) the exact error line and
> the phase it failed in. If a build errors, fetch the real log to diagnose:
> `eas build:view <id> --json` → `logFiles[0]` is a brotli-encoded URL; decode with
> `curl -s <url> | node -e "const z=require('zlib'),fs=require('fs');let c=[];process.stdin.on('data',d=>c.push(d)).on('end',()=>console.log(z.brotliDecompressSync(Buffer.concat(c)).toString()))"`.

**iOS agent** command — export the ASC API key so EAS can generate the iOS
distribution cert + profile non-interactively on first run, then build+submit:
```bash
cd <REPO_ROOT>
export EXPO_ASC_API_KEY_PATH="$(node -p "require('./eas.json').submit.production.ios.ascApiKeyPath")"
export EXPO_ASC_KEY_ID="$(node -p "require('./eas.json').submit.production.ios.ascApiKeyId")"
export EXPO_ASC_ISSUER_ID="$(node -p "require('./eas.json').submit.production.ios.ascApiKeyIssuerId")"
eas build --profile production --platform ios --auto-submit --non-interactive
```

**Android agent** command — keystore is already stored on EAS; `--auto-submit`
uses the service-account key from eas.json to push to the configured Play track:
```bash
cd <REPO_ROOT>
eas build --profile production --platform android --auto-submit --non-interactive
```

## 3. Aggregate & report

Wait for both agents, then give the user ONE combined summary:

- **iOS** — build status + URL, and submission status (App Store Connect / TestFlight).
- **Android** — build status + URL, and submission status (Google Play `<track>`).

If either failed, surface the concrete error and the single next action. Never
report success for a platform whose submit step didn't confirm.

---

## Credential setup (one-time — referenced by preflight)

Secrets live in the gitignored `credentials/` folder; non-secret IDs live in
`eas.json`. Nothing here is committed (`credentials/` and `*.p8` are gitignored).

**iOS — App Store Connect API key** (App Store Connect → Users and Access →
Integrations → generate a **Team Key** with **App Manager** or **Admin** access):
1. Save the downloaded `.p8` to `credentials/asc-api-key.p8`.
2. Fill `eas.json` → `submit.production.ios`:
   - `ascApiKeyPath`: `"./credentials/asc-api-key.p8"`
   - `ascApiKeyId`: the Key ID
   - `ascApiKeyIssuerId`: the Issuer ID
   - `ascAppId`: the app's Apple ID (App Store Connect → App Information)
   - `appleTeamId`: developer.apple.com → Membership → Team ID

**Android — Google Play service account** (Google Play Console → Users &
permissions / Setup → API access → create a service account with release
permissions, download its JSON key):
1. Save the JSON to `credentials/google-play-service-account.json`.
2. Fill `eas.json` → `submit.production.android`:
   - `serviceAccountKeyPath`: `"./credentials/google-play-service-account.json"`
   - `track`: e.g. `"internal"` (already set)

> Do not put empty strings in `eas.json` — EAS rejects the whole file on every
> command. Add a field only once you have its real value; leave it out otherwise.

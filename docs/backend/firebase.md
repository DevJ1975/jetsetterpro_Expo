# Firebase backend (JetSetter Pro — `jetsetter-pro`)

The Expo app uses **Firebase Auth + Firestore + Cloud Functions**. The web
config is committed as defaults in `src/core/firebase/config.ts` (Firebase API
keys are client-public — security is enforced by Firestore rules), so the app
connects out-of-the-box.

## Data model

Per-user subtree — each user reads/writes only their own:

```
users/{uid}/trips/{tripId}          ← Trip documents (two-way synced)
users/{uid}/expenses/{expenseId}    ← Expense documents (two-way synced)
users/{uid}/pushTokens/{token}      ← Expo push tokens (device registration)
users/{uid}/disruptions/{eventId}   ← flight-disruption events (written by disruptionWatch)
users/{uid}/duffelOrders/{orderId}  ← booking records (ownership guard for cancel)
```

Root collections (Cloud Functions use the Admin SDK; clients are rules-scoped):

```
flightWatches/{uid}_{IDENT}_{DATE}  ← flat mirror of upcoming flights (client-owned, uid-scoped)
flightCache/{IDENT_DATE}            ← shared flight-status cache (admin-only; TTL on purgeAt)
usage/translate_{uid}_{day}, _global_{month}  ← translation char budgets (admin-only)
meta/flightQuota_{YYYYMM}           ← monthly upstream-call counter (admin-only)
```

- **Auth:** anonymous-first (`ensureSignedIn`), email upgrade LINKS the same uid,
  account deletion wipes the subtree + root watch docs then deletes the user.
- **Sync:** push on every mutation, pull+merge on launch (`reconcile`).

## Cloud Functions

All live in `functions/` (modular; `index.js` is the entry). Every function
verifies the caller's Firebase ID token (`lib/auth.js`) and rate-limits per uid.

| Function | Trigger | Purpose | Secret(s) |
|---|---|---|---|
| `aiIris` | HTTPS POST | Streaming Anthropic proxy (IRIS) | `ANTHROPIC_API_KEY` |
| `flightData` | HTTPS GET | Flight status/position (cache-through) | `AERODATABOX_API_KEY`, `OPENSKY_*` (opt) |
| `translate` | HTTPS POST | Google Cloud Translation v2 (ADC) | — (service account) |
| `duffelApi` | HTTPS POST | Flight booking — offers/seats/orders/cancel + quote/confirm cancel (test mode) | `DUFFEL_API_KEY` |
| `flightAgent` | HTTPS POST | Genkit (Claude) flight search-and-rank specialist behind IRIS's in-chat booking | `ANTHROPIC_API_KEY`, `DUFFEL_API_KEY` |
| `disruptionWatch` | Schedule (10 min) | Diffs flight status → events + Expo push | `AERODATABOX_API_KEY`, `EXPO_ACCESS_TOKEN` (opt) |
| `stateDept` | HTTPS GET | US State Dept travel advisories (Level 1–4), cached | — (public CC-BY) |

The **flight cache** (`lib/flightCache.js`) is the free-tier protector: entries
are keyed by flight+date and shared across all users, with phase-aware TTLs
(6 h before departure, 5 min in the flight window, 90 s for positions, frozen
after arrival) and a monthly upstream-call budget that serves stale data rather
than exceeding quota.

The **travel advisories** (`stateDept.js`) come from State's public CC-BY data
API — no key. The full list is fetched once per 12 h and shared across all users
and countries (`stateDeptCache/advisories`), then filtered per request. ⚠️ The
exact `cadataapi.state.gov` URL + response shape are UNVERIFIED (network-blocked
from CI/agents) — confirm against a live call on first deploy; the normalizer
tolerates several shapes and logs a warning on mismatch. The CC-BY attribution
("U.S. Department of State, Bureau of Consular Affairs") is returned and shown in
the app. Passport application status + STEP have no API and remain deep-links.

**Runtime & cost guards** (`index.js` `setGlobalOptions`): all functions pin
`us-central1` and cap `maxInstances: 10`, so a traffic spike or abuse can't run
up an unbounded Cloud Functions + upstream-API bill. `aiIris` overrides
`timeoutSeconds: 300` (+ 512 MiB) so long streaming tool-use turns aren't cut at
the 60 s default; `flightAgent` overrides 120 s + 512 MiB and rate-limits at
6/min per uid (each call = up to 4 Claude turns + 1–2 Duffel calls). Runtime is
**Node 22** (`firebase.json` + `functions/package.json`). The per-uid rate
limiter (`lib/rate.js`) is in-memory, so it resets per instance and is bounded
by `maxInstances` — a shared (Firestore/Memorystore) limiter is the next step if
abuse appears.

**Genkit (server-side AI flows).** `functions/genkit.js` is a lazy, shared
Genkit 1.39 runtime using the official `@genkit-ai/anthropic` plugin — same
Claude models and allow-list as the `aiIris` proxy (this is a tooling layer,
not a Gemini switch). It powers `flightAgent`: a single-shot search-and-rank
flow whose tools (`searchFlights`, `getOfferDetails`) run server-side over
`lib/duffelClient.js`, with a Zod output schema. The response's offers are
joined from the REAL Duffel offers by id (`lib/rank.js`), so the model ranks
but can never invent a price. `flightAgent` is read-only against Duffel;
booking/cancel commits happen only via `duffelApi` after the user's explicit
in-app confirmation tap (IRIS stages, the user's tap commits — the model never
executes money mutations). `aiIris` deliberately stays a thin proxy: IRIS's
own tool loop is client-owned (device-coupled tools + confirm-before-commit).

## One-time console setup (owner)

In the [Firebase console](https://console.firebase.google.com/project/jetsetter-pro):

1. **Upgrade to the Blaze (pay-as-you-go) plan** — required for outbound HTTP
   from functions (Anthropic, AeroDataBox, Expo push, Translation) and Cloud
   Scheduler (`disruptionWatch`). Free-tier grants still apply; expected beta
   cost ≈ $0.
2. **Authentication → Sign-in method:** enable **Anonymous** and **Email/Password**.
3. **Firestore Database:** create it (production mode).
4. **APIs:** enable the **Cloud Translation API** on the GCP project (one click;
   `translate` runs on the default functions service account via ADC — no key).
5. **Firestore TTL:** add a TTL policy on collection group `flightCache`, field
   `purgeAt` (console → Firestore → TTL, or
   `gcloud firestore fields ttls update purgeAt --collection-group=flightCache --enable-ttl`).
6. **App Check (recommended before public beta):** register **App Attest** (iOS)
   and **Play Integrity** (Android) under App Check, initialize `firebase/app-check`
   in the client, and enforce it on the HTTPS functions. This attests requests
   come from the genuine app, shielding the free-tier flight/AI budgets from
   scripted abuse. Auth ID-token verification already gates every function; App
   Check adds device attestation on top.
7. **Both-platform config (already wired at the JS level).** The app uses the JS
   Firebase SDK, so **Auth + Firestore work on iOS and Android identically** from
   `firebaseConfig` — no per-platform native file is required for them. Push is
   split by design: **Android** uses FCM via `firebase/google-services.json`
   (present + referenced in `app.json`); **iOS** uses Expo Push → APNs via
   `eas credentials` (step 2 in §2 above), needing **no** `GoogleService-Info.plist`.
   Only to adopt **App Check (App Attest)** / native Firebase on iOS: register an
   **iOS app** (bundle `com.trainovate.jetsetterpro`) in the console, drop its
   `GoogleService-Info.plist` into `firebase/`, add
   `"ios": { "googleServicesFile": "./firebase/GoogleService-Info.plist" }` to
   `app.json`, and set `EXPO_PUBLIC_FIREBASE_IOS_APP_ID` (the client already picks
   the id per platform).

## Secrets (owner, once)

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY     # IRIS (required for live AI)
firebase functions:secrets:set AERODATABOX_API_KEY   # flight data (RapidAPI → AeroDataBox Basic, free)
firebase functions:secrets:set DUFFEL_API_KEY        # booking (Duffel test-mode token)
firebase functions:secrets:set OPENSKY_CLIENT_ID     # optional — richer live positions
firebase functions:secrets:set OPENSKY_CLIENT_SECRET # optional
firebase functions:secrets:set EXPO_ACCESS_TOKEN     # optional — authenticated Expo push
```

## Deploy (owner's machine — needs Google auth, can't run in CI/agents)

```bash
npm i -g firebase-tools && firebase login   # one-time
npm run deploy:rules        # Firestore security rules
npm run deploy:functions    # installs functions deps, deploys all functions + scheduler
npm run deploy:backend      # both in one shot
# Just the booking pair after IRIS-booking changes:
#   firebase deploy --only functions:flightAgent,functions:duffelApi
```

After the first `deploy:functions`, set the public base URL(s) in `.env.local`
(and `eas.json` already carries them for builds):

```
EXPO_PUBLIC_API_BASE=https://us-central1-jetsetter-pro.cloudfunctions.net
EXPO_PUBLIC_AI_ENDPOINT=https://us-central1-jetsetter-pro.cloudfunctions.net/aiIris
```

**Graceful degradation:** without deploy, the app still runs and syncs
trips/expenses. IRIS uses demo responses, flight/translation/booking features
show their honest "activates when the backend is deployed" states, and the TSA
estimate + offline phrasebook keep working (they need no backend).

## Push notifications (EAS credentials)

Disruption alerts send via the **Expo Push service** (`getExpoPushTokenAsync` →
`disruptionWatch` POSTs to `exp.host`). EAS holds the platform credentials — no
messaging secrets in the functions:

```bash
eas credentials   # iOS: upload/generate the APNs key; Android: upload the FCM V1 service-account JSON
```

`android.googleServicesFile` is wired in `app.json` (the file is committed);
the `expo-notifications` plugin registers the FCM service.

## Security

- Firestore rules (`firebase/firestore.rules`) enforce `request.auth.uid == uid`
  for the user subtree and a uid-scoped `flightWatches` block; `flightCache`,
  `usage`, and `meta` have no client match (admin-only).
- Every provider key lives only in a Cloud Function secret, never in the app
  bundle. Functions verify the Firebase ID token, bound requests, and rate-limit
  per user; `duffelApi` re-checks order ownership before cancel and recomputes
  the charge server-side.

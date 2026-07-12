# Firebase backend (JetSetter Pro — `jetsetter-pro`)

The Expo app uses **Firebase Auth + Firestore**. The web config is committed as
defaults in `src/core/firebase/config.ts` (Firebase API keys are client-public —
security is enforced by Firestore rules), so the app connects out-of-the-box.

## Data model

Per-user subtree — each user reads/writes only their own:

```
users/{uid}/trips/{tripId}       ← Trip documents (two-way synced)
users/{uid}/expenses/{expenseId} ← Expense documents (two-way synced)
```

- **Auth:** anonymous-first (`ensureSignedIn`), email upgrade LINKS the same uid
  (`upgradeToEmail`), account deletion wipes the subtree then deletes the user.
- **Sync:** push on every mutation, pull+merge on launch (`reconcile`). No-ops
  until signed in.

## One-time console setup (owner)

In the [Firebase console](https://console.firebase.google.com/project/jetsetter-pro):

1. **Authentication → Sign-in method:** enable **Anonymous** and **Email/Password**.
2. **Firestore Database:** create the database (production mode).
3. Deploy the security rules + function (from this repo, with the Firebase CLI):
   ```bash
   npm --prefix functions install
   firebase deploy --only firestore:rules
   firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Anthropic key
   firebase deploy --only functions
   ```
4. Copy the deployed `aiIris` URL into `.env.local`:
   ```
   EXPO_PUBLIC_AI_ENDPOINT=https://us-central1-jetsetter-pro.cloudfunctions.net/aiIris
   ```

Without step 3–4, the app still runs and syncs trips/expenses; **IRIS falls back
to demo responses** until `aiIris` is deployed and the endpoint is set.

## Turnkey deploy (owner's machine)

Deploy must run where you're signed in to Google — it can't run in CI/agent
sandboxes (no Firebase credentials there). One-time prerequisites:

```bash
npm i -g firebase-tools     # install the CLI
firebase login              # authenticate as the project owner
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Anthropic key (once)
```

Then, from the repo root, the convenience scripts wrap the CLI:

```bash
npm run deploy:rules        # Firestore security rules only
npm run deploy:functions    # installs functions deps, deploys aiIris
npm run deploy:backend      # both rules + functions in one shot
```

After the first `deploy:functions`, copy the printed `aiIris` URL into
`.env.local` as `EXPO_PUBLIC_AI_ENDPOINT` (see step 4 above) and restart the
bundler so the app picks it up.

## Security

- Firestore rules (`firebase/firestore.rules`) enforce `request.auth.uid == uid` —
  the per-user backbone (the Firebase analog of Supabase RLS).
- The **Anthropic key** lives only in the `aiIris` Cloud Function secret, never
  in the app bundle. `aiIris` verifies the caller's Firebase ID token, allow-lists
  the model, bounds the request, and rate-limits per user.

## Native Firebase (optional, later)

This uses the **firebase JS SDK** (one config, iOS + Android, works in Expo Go).
For native features (Analytics, FCM push) add `@react-native-firebase/*` + the
config plugin and drop `firebase/google-services.json` (already saved) +
`GoogleService-Info.plist` into a dev build.

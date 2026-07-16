#!/usr/bin/env bash
#
# Turnkey Firebase backend deploy for JetSetter Pro (project: jetsetter-pro).
#
# RUN THIS ON YOUR OWN MACHINE (or any machine where you can complete a Google
# browser login) — it cannot run in the Claude Code sandbox, which has no way to
# authenticate to your Google account. Secrets are entered at interactive
# prompts and never leave your machine.
#
#   bash scripts/deploy-firebase.sh
#
# Prerequisites (the script checks these):
#   • npm i -g firebase-tools   (installs the `firebase` CLI)
#   • firebase login            (authenticate as the project owner)
#   • The jetsetter-pro project on the Blaze (pay-as-you-go) plan — required for
#     outbound HTTP from functions + Cloud Scheduler. See the console steps below.
set -euo pipefail

PROJECT="jetsetter-pro"
REGION="us-central1"
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }

# ── 0. Preflight ────────────────────────────────────────────────────────────
say "Preflight"
command -v firebase >/dev/null || { warn "firebase CLI not found. Run: npm i -g firebase-tools"; exit 1; }
firebase --version
if ! firebase projects:list >/dev/null 2>&1; then
  warn "Not logged in. Running 'firebase login' (opens your browser)…"
  firebase login
fi
firebase use "$PROJECT"

cat <<'EOF'

MANUAL CONSOLE STEPS (once, cannot be scripted without gcloud auth) — do these
in https://console.firebase.google.com/project/jetsetter-pro before continuing:
  1. Upgrade to the Blaze plan (Settings → Usage and billing).
  2. Authentication → Sign-in method → enable Anonymous AND Email/Password.
  3. Firestore Database → create it (production mode) if not already.
  4. Enable the Cloud Translation API:
       https://console.cloud.google.com/apis/library/translation.googleapis.com?project=jetsetter-pro
  5. (after first deploy) Firestore → TTL → add a policy on collection group
     `flightCache`, field `purgeAt`.
EOF
read -r -p "Press Enter once the console steps above are done (or Ctrl-C to stop)… " _

# ── 1. Secrets (interactive; values never printed) ──────────────────────────
say "Secrets"
set_secret_if_missing() {
  local name="$1" required="$2" hint="$3"
  if firebase functions:secrets:access "${name}@latest" >/dev/null 2>&1; then
    echo "  ✓ ${name} already set — skipping"
    return
  fi
  if [ "$required" = "required" ]; then
    echo "  → ${name} (REQUIRED) — ${hint}"
    firebase functions:secrets:set "$name"
  else
    read -r -p "  Set optional secret ${name}? (${hint}) [y/N] " ans
    [ "${ans:-N}" = "y" ] && firebase functions:secrets:set "$name" || echo "    skipped"
  fi
}
set_secret_if_missing ANTHROPIC_API_KEY   required "IRIS assistant (Anthropic API key)"
set_secret_if_missing AERODATABOX_API_KEY required "flight data (RapidAPI → AeroDataBox subscription)"
set_secret_if_missing DUFFEL_API_KEY      required "in-app booking (Duffel TEST-mode access token)"
set_secret_if_missing OPENSKY_CLIENT_ID     optional "richer live aircraft positions"
set_secret_if_missing OPENSKY_CLIENT_SECRET optional "richer live aircraft positions"
set_secret_if_missing EXPO_ACCESS_TOKEN     optional "authenticated Expo push (recommended)"

# ── 2. Deploy rules ─────────────────────────────────────────────────────────
say "Deploy Firestore rules"
firebase deploy --only firestore:rules

# ── 3. Deploy functions ─────────────────────────────────────────────────────
say "Deploy Cloud Functions (installs functions/ deps first)"
npm --prefix functions install
firebase deploy --only functions

# ── 4. Report ───────────────────────────────────────────────────────────────
BASE="https://${REGION}-${PROJECT}.cloudfunctions.net"
say "Done"
cat <<EOF
Set these in .env.local (already committed as build env in eas.json):
  EXPO_PUBLIC_API_BASE=${BASE}
  EXPO_PUBLIC_AI_ENDPOINT=${BASE}/aiIris

Deployed functions:
  aiIris          ${BASE}/aiIris
  flightData      ${BASE}/flightData
  translate       ${BASE}/translate
  duffelApi       ${BASE}/duffelApi
  disruptionWatch (scheduled — Cloud Scheduler job auto-provisioned)

Reminder: add the Firestore TTL policy on flightCache.purgeAt (console step 5)
if you skipped it before the first deploy.
EOF

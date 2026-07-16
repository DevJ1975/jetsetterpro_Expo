#!/usr/bin/env bash
#
# eas-release.sh — turnkey EAS build + store-submit driver for JetSetter Pro.
#
# Run this on YOUR machine (macOS recommended for local prebuild parity; the
# actual compile happens on EAS cloud builders, so Linux/Windows work too).
# It never contains secrets: identifiers come from eas.json (submit.production)
# and the Google Maps key comes from your environment / EAS project env.
#
# Prereqs (see docs/RELEASE.md §0):
#   npm i -g eas-cli && eas login      # Expo account 'jamil.dev' owning projectId
#                                        42dd649a-31eb-4807-b2bd-113cdbe5b634
#   Fill submit.production in eas.json (ascAppId, appleTeamId, serviceAccountKeyPath).
#
# Usage:
#   ./scripts/eas-release.sh            # interactive menu
#   ./scripts/eas-release.sh preview    # step 1: device-QA build (both platforms)
#   ./scripts/eas-release.sh ios        # step 2: production iOS build + TestFlight submit
#   ./scripts/eas-release.sh android    # step 3: production Android build (+ submit after 1st manual upload)
#   ./scripts/eas-release.sh doctor     # local, non-remote: whoami + config sanity
#
# Every REMOTE / billable / store-pushing step is gated behind a confirmation
# prompt — READ THE COMMENT above each step before typing "yes".
#
set -euo pipefail

# --- pretty output --------------------------------------------------------
BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'
step()  { echo; echo "${BOLD}==> $*${RESET}"; }
info()  { echo "    $*"; }
warn()  { echo "${YELLOW}    ! $*${RESET}"; }
die()   { echo "${RED}    x $*${RESET}"; exit 1; }

# Confirmation gate for destructive / remote / billable actions.
confirm() {
  echo "${YELLOW}${BOLD}    READ THE COMMENT ABOVE THIS STEP FIRST.${RESET}"
  read -r -p "    $1 Type 'yes' to continue: " reply
  [ "$reply" = "yes" ] || die "Aborted by user."
}

# --- preflight ------------------------------------------------------------
cd "$(dirname "$0")/.."   # repo root, regardless of where the script is invoked
ROOT="$(pwd)"
info "Repo: ${ROOT}"

command -v eas >/dev/null 2>&1 || die "eas-cli not found. Install it: npm i -g eas-cli"
info "eas-cli: $(eas --version 2>/dev/null | head -1)"

# Must be logged in. eas whoami exits non-zero when not authenticated.
if ! WHO="$(eas whoami 2>/dev/null)"; then
  die "Not logged in to Expo. Run: ${BOLD}eas login${RESET}  (account 'jamil.dev' owning the projectId), then re-run this script."
fi
info "Logged in as: ${GREEN}${WHO}${RESET}"

# Maps key is a BUILD-TIME env consumed by app.config.ts (Android map tiles).
# For EAS CLOUD builds it must live in the build environment, not just your
# shell: add it once with  eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY \
#   --value <key> --scope project --environment production --environment preview
# (or add it under build.<profile>.env in eas.json). Absent => Android builds
# still SUCCEED but map tiles render blank. iOS uses Apple Maps (no key).
maps_check() {
  if [ -z "${GOOGLE_MAPS_ANDROID_API_KEY:-}" ]; then
    warn "GOOGLE_MAPS_ANDROID_API_KEY is not set in THIS shell."
    warn "That's fine IF you've registered it as an EAS project env var (recommended)."
    warn "If it is nowhere, Android map tiles will be BLANK (build still succeeds)."
  else
    info "GOOGLE_MAPS_ANDROID_API_KEY present in shell (ensure it's also an EAS env for cloud builds)."
  fi
}

# ==========================================================================
# STEP 1 — Device-QA build, BOTH platforms (preview profile, internal dist).
#   Remote + billable (consumes EAS build minutes). Produces an install-on-
#   device build: iOS simulator/internal, Android internal APK.
#   Install: open the EAS build page link the CLI prints, scan the QR / use the
#   install URL on the device, or `eas build:run -p android` for the emulator.
# ==========================================================================
qa_preview() {
  step "STEP 1/3 — Device QA build (preview, both platforms)"
  maps_check
  info "Runs: eas build --profile preview --platform all"
  info "After it finishes, install the build on a real iPhone + Android device"
  info "and run the golden path in docs/RELEASE.md §3."
  confirm "Start a REMOTE, billable preview build for BOTH platforms?"
  eas build --profile preview --platform all
  echo "${GREEN}    preview build(s) submitted. Watch the CLI output / EAS dashboard for install links.${RESET}"
}

# ==========================================================================
# STEP 2 — Production iOS build -> TestFlight submit.
#   Remote + billable, then PUSHES to App Store Connect. Requires
#   submit.production.ios in eas.json to be filled (ascAppId, appleTeamId) and
#   an App Store Connect API key (EAS-managed key created interactively on first
#   submit, or ascApiKeyPath/ascApiKeyId/ascApiKeyIssuerId in eas.json).
#   The FIRST submit can create the App Store Connect app record.
# ==========================================================================
release_ios() {
  step "STEP 2/3 — Production iOS build + TestFlight submit"
  info "Runs: eas build --profile production --platform ios"
  confirm "Start a REMOTE, billable PRODUCTION iOS build?"
  eas build --profile production --platform ios

  step "iOS submit -> App Store Connect / TestFlight"
  info "Runs: eas submit --profile production --platform ios --latest"
  warn "Needs submit.production.ios filled in eas.json + an ASC API key."
  confirm "SUBMIT the latest iOS build to App Store Connect (TestFlight)?"
  eas submit --profile production --platform ios --latest
  echo "${GREEN}    iOS submitted. In App Store Connect: add the build to a TestFlight group,${RESET}"
  echo "${GREEN}    answer export-compliance + privacy (location, notifications) questions.${RESET}"
}

# ==========================================================================
# STEP 3 — Production Android build (Play closed testing).
#   Remote + billable. The FIRST Android release CANNOT be submitted by EAS:
#   Google requires the very first .aab to be uploaded BY HAND in Play Console
#   to create the app + a testing track. Do that once, then re-run with
#   `android submit` for automated uploads thereafter.
# ==========================================================================
build_android() {
  step "STEP 3/3 — Production Android build"
  maps_check
  info "Runs: eas build --profile production --platform android"
  confirm "Start a REMOTE, billable PRODUCTION Android build?"
  eas build --profile production --platform android
  echo
  warn "FIRST RELEASE ONLY: download the .aab from the EAS build page and upload it"
  warn "manually in Google Play Console to create the app + a testing track."
  warn "AFTER that one-time step, run:  ./scripts/eas-release.sh android-submit"
}

submit_android() {
  step "Android submit -> Google Play (track: internal)"
  info "Runs: eas submit --profile production --platform android --latest"
  warn "Only works AFTER the first .aab was uploaded by hand (see step 3)."
  warn "Needs submit.production.android.serviceAccountKeyPath filled in eas.json."
  confirm "SUBMIT the latest Android build to Google Play?"
  eas submit --profile production --platform android --latest
  echo "${GREEN}    Android submitted to the 'internal' track. Add testers + complete the Data safety form.${RESET}"
}

# Local, non-remote sanity check (no builds, no store calls, not billable).
doctor() {
  step "Local sanity — whoami + resolved config (no remote build)"
  eas whoami
  info "Resolved public config (identity fields):"
  npx expo config --type public --json 2>/dev/null \
    | node -e "const c=JSON.parse(require('fs').readFileSync(0));console.log('    slug:',c.slug,'| owner:',c.owner,'| projectId:',c.extra?.eas?.projectId);console.log('    ios:',c.ios?.bundleIdentifier,'| android:',c.android?.package);" \
    || warn "Could not resolve config (is expo installed? run: npm install)"
  info "eas.json submit.production:"
  node -e "const s=require('./eas.json').submit?.production||{};console.log('   ',JSON.stringify(s));"
}

# --- dispatch -------------------------------------------------------------
usage() {
  cat <<EOF
${BOLD}JetSetter Pro — EAS release driver${RESET}
  ./scripts/eas-release.sh preview        Step 1: device-QA build, both platforms
  ./scripts/eas-release.sh ios            Step 2: production iOS build + TestFlight submit
  ./scripts/eas-release.sh android        Step 3: production Android build (first release)
  ./scripts/eas-release.sh android-submit         Android submit (after 1st manual upload)
  ./scripts/eas-release.sh doctor         Local whoami + config check (no builds)
  ./scripts/eas-release.sh all            Steps 1 -> 2 -> 3 in order (each gated)
EOF
}

case "${1:-menu}" in
  preview)        qa_preview ;;
  ios)            release_ios ;;
  android)        build_android ;;
  android-submit) submit_android ;;
  doctor)         doctor ;;
  all)            qa_preview; release_ios; build_android ;;
  menu|"")
    usage
    echo
    read -r -p "Select [preview/ios/android/android-submit/doctor/quit]: " choice
    case "$choice" in
      preview) qa_preview ;;
      ios) release_ios ;;
      android) build_android ;;
      android-submit) submit_android ;;
      doctor) doctor ;;
      *) info "Nothing to do." ;;
    esac
    ;;
  *) usage; die "Unknown command: $1" ;;
esac

step "Done."

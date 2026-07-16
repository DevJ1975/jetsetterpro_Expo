# Beta guide — send install links to testers (EAS internal distribution)

This is the **fastest** way to get JetSetter Pro onto a tester's phone: EAS builds
the app in the cloud and gives you a **shareable install link** (a page with a QR
code + download button). You text/email that link; the tester installs. No app
store, no review queue.

It is different from `docs/RELEASE.md`, which covers the **store** path
(TestFlight + Google Play). Use this doc for a quick closed beta; use RELEASE.md
when you're ready to ship publicly.

---

## First, three things that surprise everyone their first time

1. **There is no "upload the app to Expo" button.** You don't upload a finished
   app — you run `eas build`, and **Expo's cloud builders compile it for you** and
   host the result behind a link. "Uploading to Expo" = kicking off an EAS build.

2. **Testers CANNOT use the Expo Go app.** JetSetter Pro has custom native code
   (maps, camera, secure store, voice, notifications) and the New Architecture, so
   it can't run inside Expo Go. Testers install a **real build** of the app via the
   link — it appears as its own icon on their home screen, exactly like a store app.

3. **Android is free and works today. iOS is not free.** Putting a build on a real
   iPhone requires the **Apple Developer Program ($99/year)** — this is Apple's
   rule, and a free Expo account does not change it. Your **Android** beta has no
   such cost. So: **start with Android now**, add iOS when you're ready to pay Apple.

---

## One-time setup (do this once)

```bash
npm i -g eas-cli     # the Expo build CLI
eas login            # sign in as jamil@trainovations.com
eas whoami           # prints your Expo *username*
```

### ⚠️ The #1 first-timer blocker: project ownership

`app.json` currently declares:

- `owner: "jamil.dev"`
- `extra.eas.projectId: "42dd649a-31eb-4807-b2bd-113cdbe5b634"`

A build only works if the account you logged in as **owns that project**. So
compare the `eas whoami` output to `jamil.dev`:

- **If `eas whoami` prints `jamil.dev`** → you own it, you're done, skip ahead.
- **If it prints anything else** → run:

  ```bash
  eas init
  ```

  This links the app to *your* account — either pointing at an existing project
  you own or creating a brand-new one — and **rewrites `owner` + `projectId` in
  `app.json` for you**. Then commit that change:

  ```bash
  git add app.json && git commit -m "chore: relink EAS project to my account"
  ```

Quick sanity check any time (no build, not billable):

```bash
./scripts/eas-release.sh doctor      # prints whoami + resolved owner/projectId/bundle ids
```

### (Optional but recommended) Google Maps key for Android

Without it, **Android builds still succeed but map tiles render blank**. Maps are
a core screen, so register the key once as an EAS project env var:

```bash
eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <your-key> \
  --scope project --environment preview --environment production
```

(iOS uses Apple Maps and needs no key.) Full context in `docs/RELEASE.md §0`.

---

## Android beta — the free path (start here)

```bash
eas build --profile preview --platform android
```

- First run, the CLI asks a couple of credential questions — accept the defaults
  (**"Generate a new Android Keystore?" → yes**); EAS creates and stores it for you.
- The build runs in the cloud (~10–20 min). When it finishes, the CLI prints a
  **build page URL** like
  `https://expo.dev/accounts/<you>/projects/jetsetter-pro/builds/<id>`.
- That page has a **QR code and a download button** — that's your install link.

**That link is what you send to testers.** (See "Sending the link" below.)

The `preview` profile is already set up for this: `distribution: internal` +
`android.buildType: apk`, so it produces a single installable `.apk` that any
Android phone can sideload — no Play Store, no tester accounts.

---

## iOS beta — needs the Apple Developer Program ($99/yr)

Apple requires every tester's device to be **registered** before an app can be
side-loaded (this is "ad-hoc" distribution). EAS automates it:

1. **Enroll** at <https://developer.apple.com/programs/> ($99/yr). Wait for it to
   activate (can take a few hours to a day).

2. **Register each tester's iPhone** — send them a registration link:

   ```bash
   eas device:create
   ```

   This prints a URL/QR. Each tester opens it **on their iPhone**, installs the
   little profile it offers, and their device UDID lands in your Expo account. Do
   this once per device, before building.

3. **Build** (the `preview` profile now targets real devices, `ios.simulator: false`):

   ```bash
   eas build --profile preview --platform ios
   ```

   EAS logs into your Apple team, auto-creates the distribution certificate + an
   ad-hoc provisioning profile containing your registered devices, and builds. You
   get the same kind of build-page link — but it will **only install on the
   devices you registered in step 2**.

> **Alternative — TestFlight.** If you'd rather not chase UDIDs (or want >100
> testers / external testers), use TestFlight instead: it still needs the paid
> program, but testers just need their email + the TestFlight app, no UDID step.
> That's the `production` profile + `eas submit` flow in `docs/RELEASE.md §4`.

---

## Sending the link to testers

For **both** platforms the deliverable is the **EAS build page link** the CLI
prints (also always available under **expo.dev → your project → Builds → the
build**). Text or email that URL. What the tester does:

**Android**
1. Open the link on the phone → tap **Install/Download** → the `.apk` downloads.
2. Android warns about "unknown sources" — tap **Settings → Allow from this
   source** (Chrome/Files), then back and **Install**.
3. The app appears on the home screen. Done.

**iOS** (registered devices only)
1. Open the link on the **registered** iPhone → tap **Install**.
2. First launch: **Settings → General → VPN & Device Management → [your Apple
   team] → Trust**, then reopen the app.

> Tip: keep the same link handy — testers can always re-open it to reinstall.

---

## When you change the app

`expo-updates` is **not** installed, so there is **no over-the-air JS update**.
Every change — even a one-line JS tweak — means a **new build and a new link**:

```bash
eas build --profile preview --platform android    # (and/or ios)
```

Send the new build-page link; testers tap it to update in place (same app icon,
no need to uninstall). If you later want instant JS-only updates without a
rebuild, that's a separate future step (add `expo-updates` + `eas update`).

---

## Turnkey helper

The repo ships a guided script that runs exactly these commands with a
confirmation before anything billable:

```bash
./scripts/eas-release.sh doctor          # check login + project ownership (safe)
./scripts/eas-release.sh android-beta    # free Android internal build + link
./scripts/eas-release.sh ios-register    # register a tester's iPhone (needs paid program)
./scripts/eas-release.sh preview         # build BOTH platforms at once
```

---

## First-beta checklist

- [ ] `eas login` succeeds; `eas whoami` matches `owner` in `app.json` (or you ran `eas init`).
- [ ] `GOOGLE_MAPS_ANDROID_API_KEY` registered as an EAS env (else Android maps are blank).
- [ ] Backend deployed + secrets set (`docs/backend/firebase.md`) so IRIS/flights work in the beta.
- [ ] `eas build --profile preview --platform android` → got a build-page link.
- [ ] Installed it yourself on one Android phone and ran the golden path (`docs/RELEASE.md §3`).
- [ ] (iOS) Apple Developer Program active → `eas device:create` for each tester → `--platform ios` build.
- [ ] Sent the build-page link(s) to testers with the install steps above.

# Flight Live Activity (iOS ActivityKit)

Faithful port of the iOS app's flight Live Activity — lock-screen + Dynamic
Island live flight status. Two halves:

- **`modules/flight-live-activity/`** — an Expo native module that starts/updates/
  ends the Live Activity from JS. `src/core/services/liveActivity.ts` is the
  typed JS wrapper; it **no-ops gracefully** when the native module isn't present
  (Expo Go, Android, before prebuild), so the app runs everywhere today.
- **`targets/flight-activity/`** — the Widget Extension (Live Activity UI +
  the shared `FlightActivityAttributes`), added via `@bacons/apple-targets`.

## Status

Scaffolded and JS-bridged, but **not yet activated in `app.json`** because
activation requires an Apple Developer team (for the App Group + widget target
signing), which is still pending. The app builds and runs without it.

## Activate (on macOS, once an Apple team is available)

1. Add the config plugin to `app.json` `plugins`:
   ```json
   "@bacons/apple-targets"
   ```
2. Add to `app.json` under `ios`:
   ```json
   "infoPlist": { "NSSupportsLiveActivities": true },
   "entitlements": { "com.apple.security.application-groups": ["group.com.jetsetterpro.app"] }
   ```
3. Ensure `targets/flight-activity/FlightActivityAttributes.swift` is a member of
   **both** the app target and the widget target (it's the shared contract).
4. Generate native projects and build a dev client:
   ```bash
   npx expo prebuild --clean
   npx expo run:ios --device
   ```

## Wire it up

Call from the check-in / flight-tracking flows (ported in a later phase):

```ts
import { FlightLiveActivity } from '@/src/core/services/liveActivity';

const id = await FlightLiveActivity.start({
  flightNumber: 'DL2244', origin: 'JFK', destination: 'BOS',
  status: 'On Time', gate: 'B27', departISO, arriveISO, progress: 0,
});
await FlightLiveActivity.update(id, { ...content, status: 'Boarding' });
await FlightLiveActivity.end(id);
```

Behavior mirrors the iOS `FlightLiveActivityService`: one activity at a time,
same-flight dedup, `staleDate` = arrival+45m (or departure+4h), terminal statuses
(`departed`/`cancelled`) update-then-end-after-15m, plus an auto-end fallback.

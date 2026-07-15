// On-device in-flight telemetry — the RN analog of the iOS
// `InFlightTrackingService` sensor session. Fuses the barometer (pressure →
// altitude, Δaltitude → vertical speed) with GPS (position, ground speed,
// heading) behind an explicit Start/Stop, with permission handling and
// availability flags so screens can fall back to time-interpolated estimates.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Barometer } from 'expo-sensors';

export interface SensorSnapshot {
  /** Pressure altitude in feet (44330·(1−(p/1013.25)^0.1903)). Cabin pressure
   *  on a pressurized jet reads ~6–8k ft — expected, it's the cabin altitude. */
  altitudeFt: number | null;
  /** Smoothed vertical speed, ft/min (positive = climbing). */
  verticalSpeedFpm: number | null;
  /** GPS ground speed in knots. */
  speedKts: number | null;
  /** GPS course over ground, degrees from north. */
  heading: number | null;
  coord: { latitude: number; longitude: number } | null;
  /** True while a GPS update arrived in the last 30s. */
  hasFix: boolean;
}

const EMPTY: SensorSnapshot = {
  altitudeFt: null,
  verticalSpeedFpm: null,
  speedKts: null,
  heading: null,
  coord: null,
  hasFix: false,
};

export function useInFlightSensors() {
  const [tracking, setTracking] = useState(false);
  const [barometerAvailable, setBarometerAvailable] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SensorSnapshot>(EMPTY);

  // Session plumbing — refs only ever written from handlers/effects/listeners.
  const session = useRef(0);
  const baroSub = useRef<{ remove: () => void } | null>(null);
  const locSub = useRef<Location.LocationSubscription | null>(null);
  const freshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAlt = useRef<{ altM: number; at: number } | null>(null);
  const vsFpm = useRef(0);
  const lastFixAt = useRef(0);

  useEffect(() => {
    let mounted = true;
    Barometer.isAvailableAsync()
      .then((ok) => {
        if (mounted) setBarometerAvailable(ok);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const teardown = useCallback(() => {
    session.current += 1; // invalidates any in-flight start()
    baroSub.current?.remove();
    baroSub.current = null;
    locSub.current?.remove();
    locSub.current = null;
    if (freshTimer.current) clearInterval(freshTimer.current);
    freshTimer.current = null;
    lastAlt.current = null;
    vsFpm.current = 0;
  }, []);

  const stop = useCallback(() => {
    teardown();
    setTracking(false);
    setSnapshot((s) => ({ ...s, hasFix: false }));
  }, [teardown]);

  const start = useCallback(async () => {
    teardown();
    const id = session.current;
    setError(null);
    setTracking(true);
    lastFixAt.current = 0;

    let anySensor = false;

    // ── Barometer: altitude + vertical speed (works in airplane mode) ──────
    try {
      const baroOk = await Barometer.isAvailableAsync();
      if (session.current !== id) return;
      setBarometerAvailable(baroOk);
      if (baroOk) {
        Barometer.setUpdateInterval(1000);
        baroSub.current = Barometer.addListener(({ pressure }) => {
          if (!Number.isFinite(pressure) || pressure <= 0) return;
          const altM = 44330 * (1 - Math.pow(pressure / 1013.25, 0.1903));
          const at = Date.now();
          const prev = lastAlt.current;
          if (prev) {
            const dt = (at - prev.at) / 1000;
            if (dt <= 0.2) return; // clustered samples → unstable derivative
            const raw = ((altM - prev.altM) / dt) * 196.85; // m/s → ft/min
            vsFpm.current = vsFpm.current * 0.7 + raw * 0.3; // low-pass smooth
          }
          lastAlt.current = { altM, at };
          const altitudeFt = Math.round(altM * 3.28084);
          const verticalSpeedFpm = Math.round(vsFpm.current);
          setSnapshot((s) => ({ ...s, altitudeFt, verticalSpeedFpm }));
        });
        anySensor = true;
      }
    } catch {
      // Barometer unavailable — GPS may still work below.
    }

    // ── GPS: position, ground speed, heading (window seat recommended) ─────
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (session.current !== id) return;
      if (perm.status === 'granted') {
        setLocationGranted(true);
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 25,
          },
          (loc) => {
            lastFixAt.current = Date.now();
            const { latitude, longitude, speed, heading } = loc.coords;
            setSnapshot((s) => ({
              ...s,
              coord: { latitude, longitude },
              speedKts: speed != null && speed >= 0 ? Math.round(speed * 1.94384) : s.speedKts,
              heading: heading != null && heading >= 0 ? Math.round(heading) : s.heading,
              hasFix: true,
            }));
          },
        );
        if (session.current !== id) {
          sub.remove();
          return;
        }
        locSub.current = sub;
        anySensor = true;
      } else {
        setLocationGranted(false);
        setError('Location permission denied — live position and speed unavailable.');
      }
    } catch {
      if (session.current !== id) return;
      setError('GPS unavailable. A window seat helps at altitude.');
    }

    // Age out a stale GPS fix so old positions never read as "locked".
    freshTimer.current = setInterval(() => {
      const fresh = Date.now() - lastFixAt.current < 30_000;
      setSnapshot((s) => (s.hasFix === fresh ? s : { ...s, hasFix: fresh }));
    }, 10_000);

    if (!anySensor) {
      setError('No live sensors available on this device — showing estimates.');
    }
  }, [teardown]);

  // Full cleanup on unmount.
  useEffect(() => teardown, [teardown]);

  return {
    tracking,
    available: { barometer: barometerAvailable, location: locationGranted },
    snapshot,
    error,
    start,
    stop,
  };
}

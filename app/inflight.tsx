// In-Flight mode — port of iOS InFlightView + InFlightTrackingService. Live
// phase pill, animated plane phase visual, destination local-time clock, the
// route map with a real GPS / API / interpolated plane, a 2×2 telemetry grid
// (barometer + GPS behind Start/Stop), and the GPS coordinate card. Flight
// context resolves params → itinerary auto-detect (am I flying right now?) →
// a seeded JFK→NRT demo, and everything estimated is labeled DEMO/EST.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { type ComponentProps } from 'react';
import { Platform, Text, View } from 'react-native';
import { Badge, Button, Card, StatusDot, palette, spacing, type } from '@/src/ui';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Screen } from '@/src/features/common/Screen';
import { isBackendConfigured } from '@/src/core/api/backend';
import { useFlightPosition, useFlightStatus } from '@/src/core/api/flights';
import { greatCirclePath } from '@/src/core/data/airports';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { parseRoute, phaseOf } from '@/src/core/flightPhase';
import { relativeDayLabel, toISODate } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';
import { PlanePhaseVisual } from '@/src/features/flight/PlanePhaseVisual';
import { RouteMap } from '@/src/features/flight/RouteMap';
import { airportUtcOffsetMin, demoFlightStatus } from '@/src/features/flight/demo';
import { useInFlightSensors } from '@/src/features/flight/useInFlightSensors';
import { pad2, parseOffsetMin } from '@/src/features/flight/util';
import type { Trip } from '@/src/types/models';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

type IconName = ComponentProps<typeof Ionicons>['name'];

// Cruise-book estimates per time-interpolated phase (display only).
const EST_SPEED: Record<string, number> = {
  'Taxi & Takeoff': 160,
  Climb: 320,
  Cruise: 480,
  Descent: 300,
  'Final approach': 180,
};
const EST_VS: Record<string, number> = {
  'Taxi & Takeoff': 1200,
  Climb: 1800,
  Cruise: 0,
  Descent: -1500,
  'Final approach': -700,
};
const PHASE_ICON: Record<string, IconName> = {
  'Taxi & Takeoff': 'airplane',
  Climb: 'trending-up',
  Cruise: 'airplane',
  Descent: 'trending-down',
  'Final approach': 'airplane',
};

/** The itinerary flight whose window contains `now`, if any (auto-detect). */
function activeFlight(trips: Trip[], now: number) {
  for (const t of trips) {
    for (const i of t.items) {
      if (i.type !== 'flight' || !i.endDate) continue;
      const start = new Date(i.startDate).getTime();
      const end = new Date(i.endDate).getTime();
      if (start <= now && now <= end) return { trip: t, item: i, start, end };
    }
  }
  return null;
}

function bearingAt(path: { latitude: number; longitude: number }[], index: number): number | null {
  if (path.length < 2) return null;
  const i = Math.max(0, Math.min(index, path.length - 2));
  const a = path[i];
  const b = path[i + 1];
  const deg = (Math.atan2(b.longitude - a.longitude, b.latitude - a.latitude) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

/** Destination wall-clock — its own 1s ticker so only this card re-renders. */
function DestinationClock({ iata, offsetMin }: { iata: string; offsetMin: number }) {
  const now = useNow(1000);
  const shifted = new Date(now + offsetMin * 60_000);
  const clock = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
  const deviceOffset = -new Date(now).getTimezoneOffset();
  const diffMin = offsetMin - deviceOffset;
  const absH = Math.abs(diffMin) / 60;
  const diffNote =
    diffMin === 0
      ? 'Same time zone as home'
      : `${diffMin > 0 ? '+' : '−'}${Number.isInteger(absH) ? absH : absH.toFixed(1)}h vs home`;
  return (
    <Card variant="glass">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name="time" size={24} color={palette.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.overline, { color: palette.dim }]}>Local time · {iata}</Text>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 30,
              fontWeight: '700',
              color: palette.text,
              marginTop: 2,
            }}
          >
            {clock}
          </Text>
          <Text style={type.caption}>{diffNote}</Text>
        </View>
      </View>
    </Card>
  );
}

function StatTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={11} color={palette.accent} />
        <Text style={[type.overline, { fontSize: 9, color: palette.accent, letterSpacing: 1.3 }]}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        <Text style={[type.stat, { fontSize: 28 }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={[type.caption, { fontWeight: '600' }]}>{unit}</Text> : null}
      </View>
    </Card>
  );
}

export default function InFlightScreen() {
  const params = useLocalSearchParams<{
    ident?: string;
    date?: string;
    origin?: string;
    dest?: string;
  }>();
  const trips = useTravel((s) => s.trips);
  const now = useNow(30_000); // progress/phase tick (the clock ticks on its own)
  const live = isBackendConfigured();
  const sensors = useInFlightSensors();

  const pIdent = typeof params.ident === 'string' ? params.ident.toUpperCase() : '';
  const pOrigin = typeof params.origin === 'string' ? params.origin.toUpperCase() : '';
  const pDest = typeof params.dest === 'string' ? params.dest.toUpperCase() : '';
  const pDate = typeof params.date === 'string' ? params.date : '';

  const active = activeFlight(trips, now);
  const activeRoute = active ? parseRoute(active.item.title) : null;
  const activeIdent = active ? extractFlightNumber(active.item.title) : null;
  const mode: 'params' | 'itinerary' | 'demo' = pOrigin && pDest ? 'params' : active ? 'itinerary' : 'demo';

  // Live status (params or detected flight) when the backend is configured.
  const queryIdent = pIdent || activeIdent || '';
  const queryDate = pDate || (active ? active.item.startDate.slice(0, 10) : toISODate(new Date(now)));
  const statusQ = useFlightStatus(live && queryIdent ? queryIdent : null, live && queryIdent ? queryDate : null);
  const statusData = statusQ.data ?? null;
  const posQ = useFlightPosition(live ? statusData : null);

  // ── Resolve the flight context (route, times, labels) ──────────────────
  const demoBase =
    mode === 'demo'
      ? demoFlightStatus('JS100', toISODate(new Date(now)), now, { origin: 'JFK', dest: 'NRT' })
      : mode === 'params' && !statusData
        ? demoFlightStatus(pIdent || 'JS100', queryDate, now, { origin: pOrigin, dest: pDest })
        : null;

  const origin = mode === 'itinerary' ? (activeRoute?.origin ?? '') : (statusData?.origin.iata ?? demoBase?.origin.iata ?? pOrigin);
  const dest = mode === 'itinerary' ? (activeRoute?.dest ?? '') : (statusData?.destination.iata ?? demoBase?.destination.iata ?? pDest);
  const identLabel = pIdent || activeIdent || (mode === 'demo' ? 'JS100' : '');

  let depMs = NaN;
  let arrMs = NaN;
  if (mode === 'itinerary' && active) {
    depMs = active.start;
    arrMs = active.end;
  } else {
    const src = statusData ?? demoBase;
    depMs = Date.parse(
      src?.origin.times.actual ?? src?.origin.times.estimated ?? src?.origin.times.scheduled ?? '',
    );
    arrMs = Date.parse(src?.destination.times.estimated ?? src?.destination.times.scheduled ?? '');
  }
  const progress =
    Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
      ? Math.max(0, Math.min(1, (now - depMs) / (arrMs - depMs)))
      : 0.42;
  const phase = phaseOf(progress);

  const destOffsetMin =
    parseOffsetMin(statusData?.destination.times.scheduled ?? demoBase?.destination.times.scheduled) ??
    (dest ? airportUtcOffsetMin(dest) : null);

  // ── Estimates along the great circle (fallback for every sensor gap) ───
  const path = origin && dest ? greatCirclePath(origin, dest, 64) : [];
  const estIdx = path.length ? Math.round(progress * (path.length - 1)) : 0;
  const estCoord = path.length ? path[estIdx] : null;
  const estHeading = bearingAt(path, estIdx);

  const snap = sensors.snapshot;
  const altLive = sensors.tracking && snap.altitudeFt != null;
  const speedLive = sensors.tracking && snap.hasFix && snap.speedKts != null;
  const vsLive = sensors.tracking && snap.verticalSpeedFpm != null;
  const headingLive = sensors.tracking && snap.hasFix && snap.heading != null;
  const coordLive = sensors.tracking && snap.hasFix && snap.coord != null;

  const altFt = altLive ? (snap.altitudeFt as number) : phase.alt;
  const speedKts = speedLive ? (snap.speedKts as number) : (EST_SPEED[phase.label] ?? 480);
  const vsFpm = vsLive ? (snap.verticalSpeedFpm as number) : (EST_VS[phase.label] ?? 0);
  const heading = headingLive ? snap.heading : estHeading;
  const coord = coordLive ? snap.coord : estCoord;

  const usingEstimates = !(altLive || coordLive);
  const planeFix = coordLive
    ? { latitude: snap.coord!.latitude, longitude: snap.coord!.longitude, heading: snap.heading }
    : posQ.data
      ? { latitude: posQ.data.lat, longitude: posQ.data.lon, heading: posQ.data.heading }
      : null;

  const next = mode === 'demo' ? nextUpcomingFlight(trips) : undefined;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg }}>
      <BackHeader
        overline={`${identLabel ? `${identLabel} · ` : ''}${origin || '—'} → ${dest || '—'}`}
        title="In-Flight"
        right={sensors.tracking ? <StatusDot tone="good" /> : undefined}
      />

      {/* ── DEMO / EST banner chip ─────────────────────────────────────── */}
      {mode === 'demo' || usingEstimates ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: 'rgba(255,214,10,0.15)',
            borderWidth: 0.5,
            borderColor: 'rgba(255,214,10,0.4)',
          }}
        >
          <Ionicons name="sparkles" size={14} color="#FFD60A" />
          <Text
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.5,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            {mode === 'demo'
              ? 'DEMO MODE — SIMULATED FLIGHT DATA'
              : mode === 'itinerary'
                ? 'EST — ESTIMATED FROM YOUR ITINERARY'
                : 'EST — TIME-INTERPOLATED ESTIMATES'}
          </Text>
        </View>
      ) : null}
      {next ? (
        <Text style={[type.caption, { marginTop: -spacing.sm }]}>
          Your next flight {next.item.title} departs {relativeDayLabel(next.item.startDate).toLowerCase()}.
        </Text>
      ) : null}

      {/* ── Phase pill ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0A0A1E', '#1A3040']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name={PHASE_ICON[phase.label] ?? 'airplane'} size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 1.5,
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              CURRENT PHASE
            </Text>
            <Text style={[type.heading, { color: '#FFFFFF', marginTop: 2 }]}>{phase.label}</Text>
          </View>
          {sensors.tracking ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <StatusDot tone="good" size={6} />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                LIVE
              </Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* ── Plane phase visual ─────────────────────────────────────────── */}
      <PlanePhaseVisual label={phase.label} height={170} />

      {/* ── Destination local time ─────────────────────────────────────── */}
      {dest && destOffsetMin != null ? <DestinationClock iata={dest} offsetMin={destOffsetMin} /> : null}

      {/* ── Live route map ─────────────────────────────────────────────── */}
      {origin && dest ? (
        <RouteMap origin={origin} destination={dest} plane={planeFix} progress={progress} height={180} />
      ) : null}

      {/* ── Telemetry grid ─────────────────────────────────────────────── */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile icon="trending-up" label="Altitude" value={altFt.toLocaleString()} unit="ft" />
          <StatTile icon="speedometer" label="Ground speed" value={String(speedKts)} unit="kts" />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile
            icon="swap-vertical"
            label="Vertical speed"
            value={`${vsFpm >= 0 ? '+' : ''}${vsFpm}`}
            unit="fpm"
          />
          <StatTile icon="compass" label="Heading" value={heading != null ? `${heading}°` : '—'} unit="" />
        </View>
      </View>

      {/* ── GPS / position card ────────────────────────────────────────── */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
          <Ionicons
            name={coordLive ? 'location' : 'location-outline'}
            size={13}
            color={coordLive ? palette.good : palette.dim}
          />
          <Text
            style={[
              type.overline,
              { color: coordLive ? palette.good : palette.dim, letterSpacing: 1.5, flex: 1 },
            ]}
          >
            {sensors.tracking ? (snap.hasFix ? 'GPS locked' : 'GPS searching') : 'Estimated position'}
          </Text>
          <Badge label={coordLive ? 'LIVE' : 'EST'} tone={coordLive ? 'good' : 'neutral'} />
        </View>
        {coord ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.bodyDim}>Latitude</Text>
              <Text style={{ fontFamily: MONO, fontSize: 14, fontWeight: '600', color: palette.text }}>
                {coord.latitude.toFixed(4)}°
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.bodyDim}>Longitude</Text>
              <Text style={{ fontFamily: MONO, fontSize: 14, fontWeight: '600', color: palette.text }}>
                {coord.longitude.toFixed(4)}°
              </Text>
            </View>
          </View>
        ) : (
          <Text style={type.caption}>
            Move to a window seat for live GPS position. A lock can take a few minutes at altitude.
          </Text>
        )}
      </Card>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Button
        title={sensors.tracking ? 'Stop Tracking' : 'Start Tracking'}
        variant={sensors.tracking ? 'danger' : 'primary'}
        size="lg"
        icon={
          <Ionicons
            name={sensors.tracking ? 'stop-circle' : 'play-circle'}
            size={18}
            color={sensors.tracking ? '#FFF' : '#04101F'}
          />
        }
        onPress={() => {
          if (sensors.tracking) sensors.stop();
          else void sensors.start();
        }}
      />

      {sensors.error ? (
        <Text style={[type.caption, { color: palette.warn, textAlign: 'center' }]}>{sensors.error}</Text>
      ) : null}

      {/* ── Disclaimers ────────────────────────────────────────────────── */}
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Ionicons name="speedometer-outline" size={12} color={palette.faint} />
          <Text style={[type.caption, { flex: 1 }]}>
            Altitude uses the barometer — works even in airplane mode.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Ionicons name="navigate-outline" size={12} color={palette.faint} />
          <Text style={[type.caption, { flex: 1 }]}>
            Ground speed and position need GPS — window seat recommended.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Ionicons name="battery-half-outline" size={12} color={palette.faint} />
          <Text style={[type.caption, { flex: 1 }]}>
            Continuous GPS tracking is battery-intensive — expect faster drain.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

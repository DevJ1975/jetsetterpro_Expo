// Flight detail — port of iOS FlightDetailView. Hero route map with live
// plane + flown-path emphasis, status header, DEPARTURE/ARRIVAL columns with
// airport-local times (string-sliced to preserve the airport offset), delay
// banner, weather chips, In-Flight / Check-In actions, and a poll-indicator
// footer. Falls back to labeled SAMPLE data when no backend is configured.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { type ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ProgressBar, Skeleton, palette, radii, spacing, type } from '@/src/ui';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Screen } from '@/src/features/common/Screen';
import { isBackendConfigured } from '@/src/core/api/backend';
import {
  statusLabel,
  statusTone,
  useFlightPosition,
  useFlightStatus,
  type FlightEndpoint,
  type FlightStatus,
} from '@/src/core/api/flights';
import { cToF, useWeather, type Weather } from '@/src/core/api/weather';
import { toISODate } from '@/src/core/format';
import { useCheckIn } from '@/src/core/store/checkin';
import { useNow } from '@/src/core/useNow';
import { RouteMap } from '@/src/features/flight/RouteMap';
import { demoFlightStatus } from '@/src/features/flight/demo';
import { hhmm } from '@/src/features/flight/util';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

type IconName = ComponentProps<typeof Ionicons>['name'];

function weatherIcon(code?: number): IconName {
  if (code == null) return 'cloud-outline';
  if (code <= 1) return 'sunny';
  if (code === 2) return 'partly-sunny';
  if (code >= 95) return 'thunderstorm';
  if (code >= 71 && code <= 77) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  return 'cloud';
}

function WeatherChip({ code, weather }: { code: string; weather?: Weather | null }) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: palette.fillAccent,
      }}
    >
      <Ionicons name={weatherIcon(weather?.code)} size={16} color={palette.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[type.overline, { fontSize: 10 }]}>{code}</Text>
        <Text style={[type.caption, { color: palette.text }]} numberOfLines={1}>
          {weather ? `${cToF(weather.tempC)}° · ${weather.description}` : '—'}
        </Text>
      </View>
    </View>
  );
}

function EndpointColumn({
  label,
  endpoint,
  delayMin,
  align,
}: {
  label: string;
  endpoint: FlightEndpoint;
  delayMin?: number;
  align: 'left' | 'right';
}) {
  const alignment = align === 'left' ? 'flex-start' : 'flex-end';
  const primary = endpoint.times.actual ?? endpoint.times.estimated ?? endpoint.times.scheduled;
  const delayed =
    Boolean(delayMin && delayMin > 0) &&
    Boolean(endpoint.times.scheduled) &&
    primary !== endpoint.times.scheduled;
  return (
    <View style={{ flex: 1, alignItems: alignment, gap: 3 }}>
      <Text style={[type.overline, { color: palette.bright }]}>{label}</Text>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 28,
          fontWeight: '700',
          letterSpacing: 1,
          color: palette.text,
        }}
      >
        {endpoint.iata}
      </Text>
      <Text style={type.caption} numberOfLines={1}>
        {endpoint.city ?? endpoint.name ?? '—'}
      </Text>
      <Text style={[type.heading, { marginTop: 4 }]}>{hhmm(primary)}</Text>
      {delayed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[type.caption, { textDecorationLine: 'line-through' }]}>
            {hhmm(endpoint.times.scheduled)}
          </Text>
          <Text style={[type.caption, { color: palette.warn, fontWeight: '700' }]}>+{delayMin}m</Text>
        </View>
      ) : null}
      <Text style={[type.caption, { marginTop: 4 }]}>
        Terminal {endpoint.terminal ?? '—'} · Gate {endpoint.gate ?? 'TBD'}
      </Text>
      {endpoint.baggageClaim ? (
        <Text style={type.caption}>Baggage · Carousel {endpoint.baggageClaim}</Text>
      ) : null}
    </View>
  );
}

export default function FlightDetailScreen() {
  const params = useLocalSearchParams<{ ident?: string; date?: string }>();
  const router = useRouter();
  const now = useNow(30_000);
  const live = isBackendConfigured();
  const checkedIn = useCheckIn((s) => s.checkedIn);

  const ident = String(params.ident ?? '').toUpperCase();
  const date = typeof params.date === 'string' && params.date ? params.date : toISODate(new Date(now));

  const q = useFlightStatus(live ? ident : null, live ? date : null);
  // Never lose the whole detail screen (hero map included) to a failed live
  // fetch — cold-start auth races and offline errors fall back to the labeled
  // SAMPLE data instead. Loading keeps the skeleton; a 404 (success, null)
  // still shows "No flight found".
  const usingSample = !live || q.isError;
  const flight: FlightStatus | null = usingSample
    ? demoFlightStatus(ident, date, now)
    : (q.data ?? null);
  // Don't poll live position for a sample flight.
  const posQ = useFlightPosition(usingSample ? null : flight);
  const originWx = useWeather(flight?.origin.city ?? flight?.origin.iata);
  const destWx = useWeather(flight?.destination.city ?? flight?.destination.iata);

  if (!flight) {
    return (
      <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
        <BackHeader overline="Flight Tracker" title={ident || 'Flight'} />
        {q.isLoading ? (
          // Skeleton mirrors the real detail layout (hero map → columns → row)
          // rather than a bare centered spinner.
          <View style={{ gap: spacing.lg }}>
            <Skeleton height={200} radius={radii.card} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Skeleton height={96} radius={radii.card} style={{ flex: 1 }} />
              <Skeleton height={96} radius={radii.card} style={{ flex: 1 }} />
            </View>
            <Skeleton height={64} radius={radii.card} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 72, gap: spacing.md }}>
            <Ionicons name="airplane" size={48} color="rgba(59,158,240,0.4)" />
            <Text style={[type.bodyDim, { textAlign: 'center', paddingHorizontal: spacing.xxl }]}>
              {q.isError
                ? 'We couldn’t load this flight.'
                : `No flight found for “${ident}” on ${date}.`}
            </Text>
            {q.isError ? (
              <Button title="Try again" variant="secondary" size="md" onPress={() => q.refetch()} />
            ) : null}
          </View>
        )}
      </Screen>
    );
  }

  const origin = flight.origin;
  const dest = flight.destination;
  const enroute = flight.status === 'enroute' || flight.status === 'departed';

  const depMs = Date.parse(
    origin.times.actual ?? origin.times.estimated ?? origin.times.scheduled ?? '',
  );
  const arrMs = Date.parse(dest.times.estimated ?? dest.times.scheduled ?? '');
  const progress =
    enroute && Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
      ? Math.max(0, Math.min(1, (now - depMs) / (arrMs - depMs)))
      : null;

  const plane = posQ.data
    ? { latitude: posQ.data.lat, longitude: posQ.data.lon, heading: posQ.data.heading }
    : null;

  // Check-in window keys off *scheduled* departure (airlines open relative to
  // schedule, not the delayed estimate) — same rule as iOS.
  const schedMs = Date.parse(origin.times.scheduled ?? '');
  const isCheckedIn = Boolean(checkedIn[flight.ident.toUpperCase()]);
  const canCheckIn =
    ['scheduled', 'delayed', 'boarding'].includes(flight.status) &&
    Number.isFinite(schedMs) &&
    schedMs - now > 0 &&
    schedMs - now <= 24 * 3600_000 &&
    !isCheckedIn;

  const delayMin = flight.delayMin && flight.delayMin > 0 ? flight.delayMin : null;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={flight.airline?.name ?? 'Flight'}
        title={flight.ident}
        right={<Badge label={statusLabel(flight.status, flight.delayMin)} tone={statusTone(flight.status)} />}
      />

      {usingSample ? <Badge label="SAMPLE" tone="warn" style={{ marginBottom: spacing.md }} /> : null}

      {/* ── Hero route map ─────────────────────────────────────────────── */}
      <RouteMap
        origin={origin.iata}
        destination={dest.iata}
        plane={enroute ? plane : null}
        progress={enroute ? progress : null}
        height={220}
      />

      {progress != null ? (
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <ProgressBar value={progress} height={6} />
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {Math.round(progress * 100)}% complete
          </Text>
        </View>
      ) : null}

      {/* ── Delay banner ───────────────────────────────────────────────── */}
      {delayMin ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginTop: spacing.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: palette.fillWarn,
            borderWidth: 1,
            borderColor: 'rgba(232,160,32,0.4)',
          }}
        >
          <Ionicons name="alert-circle" size={18} color={palette.warn} />
          <Text style={[type.body, { color: palette.warn, flex: 1 }]}>
            Delayed {delayMin} min · departs {hhmm(origin.times.estimated ?? origin.times.scheduled)}
          </Text>
        </View>
      ) : null}

      {/* ── Route & timing ─────────────────────────────────────────────── */}
      <Card variant="glass" style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <EndpointColumn label="Departure" endpoint={origin} delayMin={flight.delayMin} align="left" />
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: palette.lineStrong }} />
          <EndpointColumn label="Arrival" endpoint={dest} align="right" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: spacing.md,
          }}
        >
          <Ionicons name="airplane" size={12} color={palette.dim} />
          <Text style={type.caption}>
            {flight.aircraft?.model ?? 'Aircraft TBD'} · all times airport-local
          </Text>
        </View>
      </Card>

      {/* ── Weather at both ends ───────────────────────────────────────── */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}
      >
        <WeatherChip code={origin.iata} weather={originWx.data} />
        <Ionicons name="arrow-forward" size={12} color={palette.faint} />
        <WeatherChip code={dest.iata} weather={destWx.data} />
      </View>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {enroute ? (
        <Button
          title="Open In-Flight Mode"
          size="lg"
          icon={<Ionicons name="airplane" size={18} color="#04101F" />}
          onPress={() =>
            router.push({
              pathname: '/inflight',
              params: { ident: flight.ident, date, origin: origin.iata, dest: dest.iata },
            } as never)
          }
          style={{ marginTop: spacing.lg }}
        />
      ) : null}

      {canCheckIn ? (
        <Button
          title="Check In"
          size="lg"
          icon={<Ionicons name="checkmark-circle" size={18} color="#04101F" />}
          onPress={() =>
            router.push({ pathname: '/checkin', params: { ident: flight.ident, date } } as never)
          }
          style={{ marginTop: spacing.lg }}
        />
      ) : null}

      {isCheckedIn ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: spacing.lg,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: palette.fillGood,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color={palette.good} />
          <Text style={[type.sub, { color: palette.good }]}>Checked in</Text>
        </View>
      ) : null}

      {/* ── Poll indicator footer ──────────────────────────────────────── */}
      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        {usingSample
          ? 'SAMPLE DATA · connect the flight-data backend for live status'
          : flight.stale
            ? `STALE · showing last cached status · source ${flight.source}`
            : `LIVE · updates every 60s · source ${flight.source || 'AeroDataBox'}`}
      </Text>
    </Screen>
  );
}

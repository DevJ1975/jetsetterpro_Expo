// Flight Tracker — search a flight number for live status (port of iOS
// FlightTrackerView). Search bar + Today/Tomorrow date chips, a LIVE bar with
// a self-ticking "Updated Xm ago" line, the result card (tap → detail), and
// the user's own upcoming flights with live status pills. Without a backend
// the search falls back to deterministic sample data, labeled SAMPLE.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  SectionLabel,
  StatusDot,
  fonts,
  palette,
  radii,
  spacing,
  type,
} from '@/src/ui';
import { BackHeader } from '@/src/features/common/BackHeader';
import { Chips } from '@/src/features/common/Chips';
import { Screen } from '@/src/features/common/Screen';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import {
  statusLabel,
  statusTone,
  useFlightStatus,
  useFlightStatuses,
  type FlightStatus,
} from '@/src/core/api/flights';
import { isBackendConfigured } from '@/src/core/api/backend';
import { parseRoute } from '@/src/core/flightPhase';
import { toISODate } from '@/src/core/format';
import { useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';
import { demoFlightStatus } from '@/src/features/flight/demo';
import { agoLabel } from '@/src/features/flight/util';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

type DateChoice = 'today' | 'tomorrow';

export default function FlightTrackerScreen() {
  const router = useRouter();
  const trips = useTravel((s) => s.trips);
  const now = useNow(30_000); // self-ticks the "Updated Xm ago" line
  const live = isBackendConfigured();

  const [query, setQuery] = useState('');
  const [dateChoice, setDateChoice] = useState<DateChoice>('today');
  const [searched, setSearched] = useState<{ ident: string; date: string; at: number } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const todayISO = toISODate(new Date(now));
  const dateFor = (c: DateChoice) =>
    c === 'today' ? toISODate(new Date(now)) : toISODate(new Date(now + 86_400_000));

  const status = useFlightStatus(live ? searched?.ident : null, live ? searched?.date : null);
  const result: FlightStatus | null = live
    ? (status.data ?? null)
    : searched
      ? demoFlightStatus(searched.ident, searched.date, now)
      : null;
  const updatedAt = live ? status.dataUpdatedAt : (searched?.at ?? 0);

  const submit = () => {
    const ident = query.trim().toUpperCase().replace(/\s+/g, '');
    if (!ident) {
      setInputError('Please enter a flight number.');
      return;
    }
    setInputError(null);
    setSearched({ ident, date: dateFor(dateChoice), at: Date.now() });
  };

  const pickDate = (c: DateChoice) => {
    setDateChoice(c);
    if (searched) setSearched({ ...searched, date: dateFor(c), at: Date.now() });
  };

  const openDetail = (ident: string, date: string) => {
    router.push({ pathname: '/flight/[ident]', params: { ident, date } } as never);
  };

  // ── The user's own upcoming flights (live pills via useFlightStatuses) ────
  const nowISO = new Date(now).toISOString();
  const yourFlights = trips
    .flatMap((t) => t.items)
    .filter((i) => i.type === 'flight' && (i.endDate ?? i.startDate) >= nowISO)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      title: i.title,
      ident: extractFlightNumber(i.title),
      date: i.startDate.slice(0, 10),
      startMs: Date.parse(i.startDate),
      route: parseRoute(i.title),
    }));
  const queryList = yourFlights
    .filter((f) => f.ident)
    .map((f) => ({ ident: f.ident as string, date: f.date }));
  const yourStatuses = useFlightStatuses(live ? queryList : []);
  const liveByKey: Record<string, FlightStatus> = {};
  if (live) {
    queryList.forEach((q, i) => {
      const d = yourStatuses[i]?.data;
      if (d) liveByKey[`${q.ident}|${q.date}`] = d;
    });
  }

  const isSearching = live && Boolean(searched) && status.isLoading;
  const searchFailed = live && Boolean(searched) && status.isError;
  const noneFound = live && Boolean(searched) && !status.isLoading && !status.isError && !status.data;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Live status" title="Flight Tracker" />

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: 48,
            paddingHorizontal: spacing.md,
            borderRadius: radii.control,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: 'rgba(22,25,41,0.6)',
          }}
        >
          <Ionicons name="search" size={16} color={palette.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Flight number (e.g. AA100)"
            placeholderTextColor={palette.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submit}
            style={{ flex: 1, color: palette.text, fontSize: 15, fontFamily: MONO, letterSpacing: 1 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={palette.faint} />
            </Pressable>
          ) : null}
        </View>
        <Button title="Search" size="md" onPress={submit} />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Chips
          options={['today', 'tomorrow'] as const}
          value={dateChoice}
          onChange={pickDate}
          labelOf={(c) => (c === 'today' ? 'Today' : 'Tomorrow')}
        />
      </View>

      {inputError ? (
        <Text style={[type.caption, { color: palette.warn, marginTop: spacing.sm }]}>{inputError}</Text>
      ) : null}

      {/* ── LIVE bar + result ──────────────────────────────────────────── */}
      {result ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.lg,
              marginBottom: spacing.sm,
              paddingHorizontal: 2,
            }}
          >
            <StatusDot tone="good" size={6} />
            <Text
              style={{
                fontFamily: fonts.rounded.extrabold,
                fontSize: 10,
                letterSpacing: 1,
                color: palette.good,
              }}
            >
              LIVE
            </Text>
            {!live ? <Badge label="SAMPLE" tone="warn" style={{ marginLeft: 4 }} /> : null}
            <View style={{ flex: 1 }} />
            <Text style={type.caption}>Updated {agoLabel(now - updatedAt)}</Text>
            <Pressable
              onPress={() => (live ? status.refetch() : searched && setSearched({ ...searched, at: Date.now() }))}
              hitSlop={8}
              style={{ marginLeft: 6 }}
            >
              <Ionicons name="refresh" size={14} color={palette.bright} />
            </Pressable>
          </View>

          <Pressable onPress={() => openDetail(result.ident, searched?.date ?? todayISO)}>
            <Card variant="glass">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1.2 }}>
                  <Text
                    style={{
                      fontFamily: MONO,
                      fontSize: 17,
                      fontWeight: '700',
                      letterSpacing: 1,
                      color: palette.text,
                    }}
                  >
                    {result.ident}
                  </Text>
                  <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                    {result.airline?.name ?? 'Unknown airline'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={type.sub}>{result.origin.iata}</Text>
                  <Ionicons name="arrow-forward" size={12} color={palette.dim} />
                  <Text style={type.sub}>{result.destination.iata}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Badge label={statusLabel(result.status, result.delayMin)} tone={statusTone(result.status)} />
                </View>
              </View>
            </Card>
          </Pressable>
        </>
      ) : null}

      {isSearching ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
          <ActivityIndicator color={palette.bright} />
          <Text style={type.bodyDim}>Searching flights…</Text>
        </View>
      ) : null}

      {searchFailed ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
          <Ionicons name="warning" size={40} color={palette.warn} />
          <Text style={[type.bodyDim, { textAlign: 'center' }]}>
            Something went wrong. Please try again.
          </Text>
        </View>
      ) : null}

      {noneFound ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
          <Ionicons name="airplane" size={40} color="rgba(59,158,240,0.4)" />
          <Text style={[type.bodyDim, { textAlign: 'center' }]}>
            No flights found for “{searched?.ident}”.
          </Text>
        </View>
      ) : null}

      {!searched ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
          <Ionicons name="airplane" size={56} color="rgba(59,158,240,0.4)" />
          <Text style={type.sub}>Search for a flight</Text>
          <Text style={[type.bodyDim, { textAlign: 'center' }]}>
            Enter a flight number above to check{'\n'}status, gates, and delays.
          </Text>
        </View>
      ) : null}

      {/* ── Your flights ───────────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionLabel>Your flights</SectionLabel>
        {yourFlights.length === 0 ? (
          <Card variant="outline">
            <Text style={[type.bodyDim, { textAlign: 'center' }]}>
              Flights on your itinerary appear here with live status.
            </Text>
          </Card>
        ) : (
          <Card>
            {yourFlights.map((f, i) => {
              const st = f.ident ? liveByKey[`${f.ident}|${f.date}`] : undefined;
              const minutesAway = (f.startMs - now) / 60_000;
              const fallbackLabel =
                minutesAway < 0 ? 'EN ROUTE' : minutesAway <= 40 ? 'BOARDING' : 'ON TIME';
              const fallbackTone: 'good' | 'warn' = minutesAway >= 0 && minutesAway <= 40 ? 'warn' : 'good';
              return (
                <Pressable
                  key={f.id}
                  disabled={!f.ident}
                  onPress={() => f.ident && openDetail(f.ident, f.date)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: 12,
                    borderBottomWidth: i === yourFlights.length - 1 ? 0 : 0.5,
                    borderBottomColor: palette.line,
                    opacity: f.ident ? 1 : 0.5,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      fontWeight: '700',
                      letterSpacing: 1,
                      color: palette.bright,
                      width: 76,
                    }}
                  >
                    {f.ident ?? '—'}
                  </Text>
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                    {f.route.origin && f.route.dest ? `${f.route.origin} → ${f.route.dest}` : f.title}
                  </Text>
                  <Badge
                    label={st ? statusLabel(st.status, st.delayMin) : fallbackLabel}
                    tone={st ? statusTone(st.status) : fallbackTone}
                  />
                </Pressable>
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}

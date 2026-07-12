import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Input, ProgressBar, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { formatTime } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { deriveFlight, toActivityContent, type FlightStatusLabel } from '@/src/core/services/flightStatus';
import { FlightLiveActivity } from '@/src/core/services/liveActivity';

const STATUS_TONE: Record<FlightStatusLabel, 'good' | 'bad' | 'accent'> = {
  Scheduled: 'accent',
  Boarding: 'good',
  Departed: 'good',
  Landed: 'accent',
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.overline, { color: palette.dim }]}>{label}</Text>
      <Text style={type.sub}>{value}</Text>
    </View>
  );
}

export default function FlightTrackerScreen() {
  const trips = useTravel((s) => s.trips);
  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);
  const derived = useMemo(() => (flight ? deriveFlight(flight.item) : null), [flight]);

  const [search, setSearch] = useState('');
  const [tracking, setTracking] = useState(false);
  const [laNote, setLaNote] = useState<string | null>(null);

  // A typed number that doesn't match the itinerary flight can't be resolved
  // without the flight-data backend — say so rather than fabricating a status.
  const query = search.trim().replace(/\s/g, '').toUpperCase();
  const matchesItinerary = !query || (derived?.flightNumber ?? '') === query;
  const show = matchesItinerary ? derived : null;

  const track = async () => {
    if (!show) return;
    const id = await FlightLiveActivity.start(toActivityContent(show));
    if (id) {
      setTracking(true);
      setLaNote('Live Activity started — check your Lock Screen and Dynamic Island.');
    } else {
      setLaNote('Live Activities appear on a device build (iOS 16.1+). Not available here.');
    }
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="Live status · gate · progress" title="Flight Tracker" />

      <Card variant="glass" style={{ marginBottom: spacing.lg }}>
        <SectionLabel>Track a flight</SectionLabel>
        <Input
          label="Flight number"
          placeholder={derived?.flightNumber ?? 'AA100'}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="characters"
        />
        {derived ? (
          <Text style={[type.caption, { marginTop: spacing.xs }]}>
            Leave blank to track your next flight ({derived.flightNumber}).
          </Text>
        ) : null}
      </Card>

      {!show ? (
        <Card variant="glass">
          <EmptyState
            icon="airplane"
            title={query && !matchesItinerary ? `Can’t look up ${query} yet` : 'No upcoming flight'}
            subtitle={
              query && !matchesItinerary
                ? 'Live lookup for any flight number connects with a flight-data provider in a later update. For now, track a flight on your itinerary.'
                : 'Add a flight to your itinerary and it appears here with live status.'
            }
          />
        </Card>
      ) : (
        <>
          <Card variant="glass" style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.heading, { flex: 1 }]}>{show.flightNumber}</Text>
              <Badge tone={STATUS_TONE[show.status]} label={show.status} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.stat, { flex: 1 }]}>{show.origin || '—'}</Text>
              <Ionicons name="airplane" size={20} color={palette.bright} />
              <Text style={[type.stat, { flex: 1, textAlign: 'right' }]}>{show.destination || '—'}</Text>
            </View>
            <ProgressBar value={show.progress} height={8} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.caption}>Dep {formatTime(show.departISO)}</Text>
              <Text style={type.caption}>{Math.round(show.progress * 100)}%</Text>
              <Text style={type.caption}>{show.arriveISO ? `Arr ${formatTime(show.arriveISO)}` : '—'}</Text>
            </View>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionLabel>Details</SectionLabel>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              <Metric label="Gate" value={show.gate ?? '—'} />
              <Metric label="Phase" value={show.phase} />
              <Metric label="Altitude" value={show.altitudeFt > 0 ? `~${show.altitudeFt.toLocaleString()} ft` : '—'} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Metric label="Status" value={show.delayMin > 0 ? `Delayed ${show.delayMin}m` : 'On time'} />
              <Metric label="Origin" value={show.origin || '—'} />
              <Metric label="Destination" value={show.destination || '—'} />
            </View>
          </Card>

          <Button
            title={tracking ? 'Tracking in Live Activity' : 'Track in Live Activity'}
            variant={tracking ? 'secondary' : 'primary'}
            onPress={track}
            disabled={tracking}
            style={{ marginTop: spacing.lg }}
          />
          {laNote ? (
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>{laNote}</Text>
          ) : null}
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
            Status estimated from your itinerary. Live gate & position connect with a flight-data provider in a
            later update.
          </Text>
        </>
      )}
    </Screen>
  );
}

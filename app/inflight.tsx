import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { Card, ProgressBar, SectionLabel, StatusDot, ScreenHeader, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { formatTime, relativeDayLabel } from '@/src/core/format';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';
import type { ItineraryItem, Trip } from '@/src/types/models';

function parseRoute(title: string): { origin: string; dest: string } {
  const m = title.match(/([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})/i);
  return m ? { origin: m[1].toUpperCase(), dest: m[2].toUpperCase() } : { origin: '', dest: '' };
}

function phaseOf(p: number): { label: string; alt: number } {
  if (p < 0.06) return { label: 'Taxi & Takeoff', alt: Math.round((p / 0.06) * 10000) };
  if (p < 0.22) return { label: 'Climb', alt: Math.round(10000 + ((p - 0.06) / 0.16) * 25000) };
  if (p < 0.8) return { label: 'Cruise', alt: 35000 };
  if (p < 0.95) return { label: 'Descent', alt: Math.round(35000 * (1 - (p - 0.8) / 0.15)) };
  return { label: 'Final approach', alt: Math.round(5000 * (1 - (p - 0.95) / 0.05)) };
}

// Pure: the flight whose window contains `now`, if any. Cheap enough to run each
// render, so no manual useMemo (which the React Compiler couldn't preserve here).
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

export default function InFlightScreen() {
  const trips = useTravel((s) => s.trips);
  const now = useNow(30_000); // re-check "am I flying?" every 30s
  const active = activeFlight(trips, now);

  if (!active) {
    const next = nextUpcomingFlight(trips);
    return (
      <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
        <ScreenHeader overline="Live" title="In-Flight" style={{ paddingHorizontal: 0 }} />
        <Card variant="glass">
          <EmptyState
            icon="airplane"
            title="Not in the air"
            subtitle={
              next
                ? `Your next flight ${next.item.title} departs ${relativeDayLabel(next.item.startDate).toLowerCase()}.`
                : 'This lights up automatically while you’re flying.'
            }
          />
        </Card>
      </Screen>
    );
  }

  return <InFlightView trip={active.trip} item={active.item} start={active.start} end={active.end} />;
}

function InFlightView({ item, start, end }: { trip: Trip; item: ItineraryItem; start: number; end: number }) {
  const now = useNow(30_000); // advance the live flight progress every 30s
  const progress = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const { origin, dest } = parseRoute(item.title);
  const phase = phaseOf(progress);
  const remainingMin = Math.max(0, Math.round((end - now) / 60_000));
  const rh = Math.floor(remainingMin / 60);
  const rm = remainingMin % 60;

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <ScreenHeader
        overline={item.title}
        title="In-Flight"
        right={<StatusDot tone="good" />}
        style={{ paddingHorizontal: 0 }}
      />

      <Card variant="glass" style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[type.stat, { flex: 1 }]}>{origin || '—'}</Text>
          <Ionicons name="airplane" size={22} color={palette.bright} />
          <Text style={[type.stat, { flex: 1, textAlign: 'right' }]}>{dest || '—'}</Text>
        </View>
        <ProgressBar value={progress} height={8} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.caption}>Dep {formatTime(new Date(start).toISOString())}</Text>
          <Text style={type.caption}>{Math.round(progress * 100)}%</Text>
          <Text style={type.caption}>Arr {formatTime(new Date(end).toISOString())}</Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionLabel>Status</SectionLabel>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.overline, { color: palette.dim }]}>Phase</Text>
            <Text style={type.sub}>{phase.label}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.overline, { color: palette.dim }]}>Altitude</Text>
            <Text style={type.sub}>~{phase.alt.toLocaleString()} ft</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.overline, { color: palette.dim }]}>Remaining</Text>
            <Text style={type.sub}>{rh > 0 ? `${rh}h ` : ''}{rm}m</Text>
          </View>
        </View>
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Estimated from your itinerary. Live GPS altitude connects with device sensors in a later update.
      </Text>
    </Screen>
  );
}

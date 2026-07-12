import React, { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { Card, ScreenHeader, StatusDot, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { EmptyState } from '@/src/features/common/EmptyState';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { formatTime } from '@/src/core/format';
import { useTravel } from '@/src/core/store/travel';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

function parseDest(title: string): string {
  const m = title.match(/([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})/i);
  return m ? m[2].toUpperCase() : '—';
}
function parseGate(location?: string): string {
  const m = location?.match(/gate\s*([A-Z]?\d+[A-Z]?)/i);
  return m ? m[1].toUpperCase() : '—';
}

const HW = { flight: 2.2, dest: 1, time: 1.4, gate: 0.9, status: 1.6 };

function Cell({ text, w, color, bold }: { text: string; w: number; color: string; bold?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{ flex: w, color, fontFamily: MONO, fontSize: 13, fontWeight: bold ? '700' : '400', letterSpacing: 0.5 }}
    >
      {text}
    </Text>
  );
}

export default function BoardScreen() {
  const trips = useTravel((s) => s.trips);

  const rows = useMemo(() => {
    const nowISO = new Date().toISOString();
    return trips
      .flatMap((t) => t.items.filter((i) => i.type === 'flight'))
      .filter((i) => (i.endDate ?? i.startDate) >= nowISO)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((i) => ({
        flight: extractFlightNumber(i.title) ?? i.title.slice(0, 7),
        dest: parseDest(i.title),
        time: formatTime(i.startDate),
        gate: parseGate(i.location),
      }));
  }, [trips]);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <ScreenHeader
        overline="Your departures"
        title="Departure Board"
        right={<StatusDot tone="good" />}
        style={{ paddingHorizontal: 0 }}
      />

      {rows.length === 0 ? (
        <Card variant="glass">
          <EmptyState icon="grid" title="No upcoming flights" subtitle="Flights on your itinerary appear here as a live board." />
        </Card>
      ) : (
        <Card style={{ backgroundColor: '#0A0D16' }}>
          <View style={{ flexDirection: 'row', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.line }}>
            <Cell text="FLIGHT" w={HW.flight} color={palette.faint} />
            <Cell text="TO" w={HW.dest} color={palette.faint} />
            <Cell text="DEPARTS" w={HW.time} color={palette.faint} />
            <Cell text="GATE" w={HW.gate} color={palette.faint} />
            <Cell text="STATUS" w={HW.status} color={palette.faint} />
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: i === rows.length - 1 ? 0 : 0.5, borderBottomColor: palette.line }}>
              <Cell text={r.flight} w={HW.flight} color={palette.warn} bold />
              <Cell text={r.dest} w={HW.dest} color={palette.text} bold />
              <Cell text={r.time} w={HW.time} color={palette.text} />
              <Cell text={r.gate} w={HW.gate} color={palette.text} />
              <Cell text="ON TIME" w={HW.status} color={palette.good} bold />
            </View>
          ))}
        </Card>
      )}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Live gate & status updates connect with a flight-data source in a later update.
      </Text>
    </Screen>
  );
}

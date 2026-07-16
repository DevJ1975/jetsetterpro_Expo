import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, SectionLabel, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { parseRoute } from '@/src/core/flightPhase';
import { timeAgo, useIntelligence } from '@/src/core/store/intelligence';
import { nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import { useNow } from '@/src/core/useNow';

// Proactive Intelligence — port of iOS IntelligenceHistoryView: ACTIVE NOW
// monitors with LIVE badges, the RECENT ACTIONS log, and the explainer card.

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const WATCHES = [
  'Check-in windows opening',
  'When to leave for the airport',
  'Packing & visa reminders before trips',
  'Weather at your destination',
  'Budget pacing while traveling',
];

// Tile tints per action icon (≈ the iOS per-entry colorHex values).
const ICON_COLORS: Record<string, string> = {
  'checkmark-circle': palette.good,
  'swap-horizontal': palette.warn,
  car: '#7B3FBF',
  rainy: palette.accent,
  'document-text': '#5B8DEF',
  'close-circle': palette.bad,
};

const tint = (color: string) => `${color}26`; // hex + 15% alpha

export default function IntelligenceScreen() {
  const trips = useTravel((s) => s.trips);
  const actions = useIntelligence((s) => s.actions);
  const now = useNow(30_000);

  const flight = useMemo(() => nextUpcomingFlight(trips), [trips]);

  // 1–2 live monitors derived from the itinerary (what IRIS is doing right now).
  const monitors = useMemo(() => {
    const out: { icon: IoniconName; title: string; body: string }[] = [];
    if (!flight) return out;
    const ident = extractFlightNumber(flight.item.title);
    const r = parseRoute(flight.item.location ?? '');
    const route = r.origin && r.dest ? `${r.origin} → ${r.dest}` : '';
    if (ident) {
      out.push({
        icon: 'airplane',
        title: `Monitoring ${ident} for gate changes`,
        body: `Delay, gate, and cancellation watch${route ? ` · ${route}` : ''}`,
      });
    }
    const destCity = flight.trip.destination.split(',')[0].trim();
    if (destCity) {
      out.push({
        icon: 'partly-sunny',
        title: `Watching ${destCity} weather`,
        body: 'Packing list updates if the forecast shifts before departure',
      });
    }
    return out;
  }, [flight]);

  const history = useMemo(
    () => [...actions].sort((a, b) => b.at.localeCompare(a.at)),
    [actions],
  );

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="What IRIS is watching" title="Proactive Intelligence" />

      {monitors.length > 0 ? (
        <View style={{ marginBottom: spacing.xl }}>
          <SectionLabel>Active now</SectionLabel>
          <View style={{ gap: spacing.md }}>
            {monitors.map((m) => (
              <Card key={m.title}>
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: palette.fillAccent }]}>
                    <Ionicons name={m.icon} size={16} color={palette.bright} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {m.title}
                      </Text>
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    </View>
                    <Text style={[type.caption, { marginTop: 3 }]} numberOfLines={2}>
                      {m.body}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      <SectionLabel>Recent actions</SectionLabel>
      {history.length === 0 ? (
        <Card>
          <Text style={type.bodyDim}>
            Nothing logged yet. IRIS records the actions it takes for you here.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {history.map((a) => {
            const color = ICON_COLORS[a.icon] ?? palette.bright;
            return (
              <Card key={a.id}>
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: tint(color) }]}>
                    <Ionicons name={a.icon as IoniconName} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={styles.timeAgo}>{timeAgo(a.at, now)}</Text>
                    </View>
                    <Text style={[type.caption, { marginTop: 3 }]} numberOfLines={2}>
                      {a.outcome}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Card style={{ marginTop: spacing.xl }}>
        <SectionLabel>What IRIS watches</SectionLabel>
        {WATCHES.map((w) => (
          <View key={w} style={styles.watchRow}>
            <View style={styles.watchDot} />
            <Text style={type.body}>{w}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: palette.text },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: palette.good,
  },
  liveText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#FFFFFF' },
  timeAgo: { fontSize: 11, color: palette.dim },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  watchDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.bright },
});

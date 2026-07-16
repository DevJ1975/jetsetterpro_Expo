import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Badge, Card, StatusDot, palette, radii, spacing, type } from '@/src/ui';
import { statusLabel, statusTone, useFlightStatus } from '@/src/core/api/flights';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { parseRoute } from '@/src/core/flightPhase';
import { formatDate, formatTime } from '@/src/core/format';
import { useCheckIn } from '@/src/core/store/checkin';
import { useNow } from '@/src/core/useNow';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import type { ItineraryItem, Trip } from '@/src/types/models';

// The Home hero — a faithful port of iOS HomeView.nextFlightCard: overline
// header + countdown capsule, big monospaced ident, route row over a slim
// route strip, GATE / AIRLINE / DEPARTS columns, then full-bleed actions.

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const DIVIDER = 'rgba(255,255,255,0.1)';

// iOS HomeViewModel.airlineNames — short carrier names from the IATA prefix.
const AIRLINE_NAMES: Record<string, string> = {
  AA: 'American', UA: 'United', DL: 'Delta',
  WN: 'Southwest', AS: 'Alaska', B6: 'JetBlue',
  NK: 'Spirit', F9: 'Frontier', G4: 'Allegiant',
  HA: 'Hawaiian', BA: 'British', LH: 'Lufthansa',
  AF: 'Air France', EK: 'Emirates', QR: 'Qatar',
  SQ: 'Singapore', CX: 'Cathay', JL: 'Japan Air',
  NH: 'ANA', KE: 'Korean Air', AC: 'Air Canada',
  QF: 'Qantas', TK: 'Turkish', EY: 'Etihad',
};

function airlineName(ident: string | null): string {
  const code = ident?.match(/^[A-Z]{2,3}/)?.[0];
  if (!code) return '—';
  return AIRLINE_NAMES[code] ?? `${code} Airlines`;
}

/** "3d 4h" / "2h 15m" / "45m" — iOS timeUntilFlight. */
function countdownLabel(departISO: string, nowMs: number): string {
  const diffMin = Math.floor((Date.parse(departISO) - nowMs) / 60_000);
  if (diffMin <= 0) return 'Boarding';
  const d = Math.floor(diffMin / 1440);
  const h = Math.floor((diffMin % 1440) / 60);
  const m = diffMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Gate parsed from itinerary notes, e.g. "B22" from "Gate B22 · Seat 3A". */
function parseGate(notes?: string): string | null {
  const m = notes?.match(/Gate\s+([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : null;
}

function firstFinite(...values: (string | undefined)[]): number | null {
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

export function NextFlightCard({ flight }: { flight?: { trip: Trip; item: ItineraryItem } }) {
  const router = useRouter();
  const now = useNow(60_000);
  const isCheckedIn = useCheckIn((s) => s.isCheckedIn);

  const item = flight?.item;
  const ident = item ? extractFlightNumber(item.title) : null;
  const date = item?.startDate.slice(0, 10);
  const { data: live } = useFlightStatus(ident, date);

  const progress = useMemo(() => {
    if (!item) return 0;
    const dep = firstFinite(
      live?.origin.times.actual,
      live?.origin.times.estimated,
      live?.origin.times.scheduled,
      item.startDate,
    );
    const arr = firstFinite(
      live?.destination.times.actual,
      live?.destination.times.estimated,
      live?.destination.times.scheduled,
      item.endDate,
    );
    if (dep == null || arr == null || arr <= dep) return 0;
    return Math.min(1, Math.max(0, (now - dep) / (arr - dep)));
  }, [item, live, now]);

  if (!flight || !item) return <NoFlightCard />;

  const fromLoc = parseRoute(item.location ?? '');
  const fromTitle = parseRoute(item.title);
  const origin = live?.origin.iata ?? (fromLoc.origin || fromTitle.origin);
  const dest = live?.destination.iata ?? (fromLoc.dest || fromTitle.dest);
  const originCity = live?.origin.city ?? '';
  const destCity = live?.destination.city ?? flight.trip.destination.split(',')[0].trim();

  const status = live?.status ?? 'scheduled';
  const tone = statusTone(status);
  const gate = live?.origin.gate ?? parseGate(item.notes) ?? '—';
  const airline = live?.airline?.name ?? airlineName(ident);
  const departs = formatTime(
    live?.origin.times.estimated ?? live?.origin.times.scheduled ?? item.startDate,
  );
  const checkedIn = ident ? isCheckedIn(ident) : false;

  const openCheckIn = () => {
    if (ident && date) router.push({ pathname: '/checkin', params: { ident, date } });
  };
  const openTracker = () => {
    if (ident) router.push(`/flight/${ident}?date=${date ?? ''}`);
  };

  return (
    <Card>
      {/* ── Header: overline + live dot | countdown capsule ── */}
      <View style={styles.headerRow}>
        <Ionicons name="airplane" size={12} color={palette.bright} />
        <Text style={[type.overline, { color: palette.bright }]}>Next flight</Text>
        <StatusDot tone={tone === 'neutral' ? 'accent' : tone} size={5} />
        <View style={{ flex: 1 }} />
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdownLabel(item.startDate, now)}</Text>
        </View>
      </View>

      <FullBleedDivider />

      {/* ── Ident + status + route ── */}
      <View style={{ paddingVertical: spacing.lg, gap: 10 }}>
        <View style={styles.identRow}>
          <Text
            style={styles.ident}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {ident ?? '—'}
          </Text>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge tone={tone} label={statusLabel(status, live?.delayMin)} />
            <Text style={styles.dateLabel}>
              {formatDate(item.startDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {origin && dest ? (
          <>
            <View style={styles.routeRow}>
              <View style={styles.routeEnd}>
                <Text style={styles.routeCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {origin}
                </Text>
                {originCity ? (
                  <Text style={styles.routeCity} numberOfLines={1}>{originCity}</Text>
                ) : null}
              </View>
              <Ionicons name="airplane" size={20} color={palette.bright} />
              <View style={[styles.routeEnd, { alignItems: 'flex-end' }]}>
                <Text style={styles.routeCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {dest}
                </Text>
                {destCity ? (
                  <Text style={styles.routeCity} numberOfLines={1}>{destCity}</Text>
                ) : null}
              </View>
            </View>
            <RouteStrip progress={progress} />
          </>
        ) : (
          <Text style={type.sub}>{item.location ?? item.title}</Text>
        )}
      </View>

      <FullBleedDivider />

      {/* ── GATE / AIRLINE / DEPARTS ── */}
      <View style={styles.detailStrip}>
        <DetailColumn label="Gate" value={gate} />
        <View style={styles.thinDivider} />
        <DetailColumn label="Airline" value={airline} />
        <View style={styles.thinDivider} />
        <DetailColumn label="Departs" value={departs} />
      </View>

      <FullBleedDivider />

      {/* ── Actions (full-bleed rows, iOS style) ── */}
      {checkedIn ? (
        <View style={styles.actionRow}>
          <Ionicons name="checkmark-circle" size={17} color={palette.good} />
          <Text style={[styles.actionText, { color: palette.good }]}>Checked In</Text>
        </View>
      ) : (
        <Pressable
          onPress={openCheckIn}
          disabled={!ident}
          style={({ pressed }) => [
            styles.actionRow,
            { backgroundColor: palette.accent },
            pressed && { opacity: 0.85 },
            !ident && { opacity: 0.4 },
          ]}
        >
          <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Check In</Text>
        </Pressable>
      )}
      <Pressable
        onPress={openTracker}
        disabled={!ident}
        style={({ pressed }) => [
          styles.actionRow,
          styles.lastActionRow,
          pressed && { opacity: 0.7 },
          !ident && { opacity: 0.4 },
        ]}
      >
        <Ionicons name="radio" size={17} color={palette.bright} />
        <Text style={[styles.actionText, { color: palette.bright }]}>Track Flight</Text>
      </Pressable>
    </Card>
  );
}

/** Slim stylized route visual — line with the plane positioned by progress
 *  (stands in for the iOS compact FlightMapView). The plane springs to the
 *  live progress and breathes a subtle glow so the hero feels alive between
 *  the 60s ticks. Snaps + still under Reduce Motion. */
function RouteStrip({ progress }: { progress: number }) {
  const reduce = useReduceMotion();
  const target = Math.min(1, Math.max(0, progress));
  const p = useSharedValue(target);
  const pulse = useSharedValue(0);

  useEffect(() => {
    p.value = reduce ? target : withSpring(target, { damping: 20, stiffness: 90 });
  }, [target, reduce, p]);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduce, pulse]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const planeStyle = useAnimatedStyle(() => ({
    left: `${p.value * 100}%`,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    shadowOpacity: 0.4 + pulse.value * 0.4,
  }));

  return (
    <View style={styles.strip}>
      <View style={styles.stripTrack} />
      <Animated.View style={[styles.stripFill, fillStyle]} />
      <View style={[styles.stripDot, { left: 0, backgroundColor: palette.bright }]} />
      <View style={[styles.stripDot, { right: 0, backgroundColor: palette.good }]} />
      <Animated.View style={[styles.stripPlane, planeStyle]}>
        <Ionicons name="airplane" size={12} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

function DetailColumn({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCol}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

function FullBleedDivider() {
  return <View style={styles.divider} />;
}

/** iOS HomeView.noFlightCard. */
function NoFlightCard() {
  const router = useRouter();
  return (
    <Card>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <Ionicons name="airplane" size={40} color="rgba(255,255,255,0.35)" />
        <Text style={type.sub}>No Upcoming Flights</Text>
        <Text style={[type.bodyDim, { textAlign: 'center' }]}>
          Add a flight to your itinerary to see it here.
        </Text>
        <Pressable
          onPress={() => router.push('/booking')}
          style={({ pressed }) => [styles.searchPill, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.searchPillText}>Search Flights</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.md,
  },
  countdownPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(59,158,240,0.2)',
  },
  countdownText: { fontSize: 12, fontWeight: '600', color: palette.text },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginHorizontal: -spacing.lg,
  },
  identRow: { flexDirection: 'row', alignItems: 'flex-start' },
  ident: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: 0.5,
  },
  dateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  routeEnd: { flex: 1 },
  routeCode: { fontFamily: MONO, fontSize: 22, fontWeight: '700', color: palette.text },
  routeCity: { fontSize: 11, color: palette.dim, marginTop: 2 },
  strip: { height: 26, justifyContent: 'center', marginTop: 2 },
  stripTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(59,158,240,0.25)',
  },
  stripFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.accent,
  },
  stripDot: {
    position: 'absolute',
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stripPlane: {
    position: 'absolute',
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.accent,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  detailStrip: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md + 2 },
  thinDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: DIVIDER },
  detailCol: { flex: 1, alignItems: 'center', gap: 3 },
  detailLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  detailValue: { fontSize: 15, fontWeight: '700', color: palette.text },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: -spacing.lg,
  },
  lastActionRow: { marginBottom: -spacing.lg },
  actionText: { fontSize: 15, fontWeight: '600' },
  searchPill: {
    marginTop: spacing.xs,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.fillAccent,
  },
  searchPillText: { fontSize: 15, fontWeight: '600', color: palette.bright },
});

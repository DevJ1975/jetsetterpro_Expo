import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { palette, shadows } from '@/src/ui';
import { formatDate, formatTime } from '@/src/core/format';
import { rngFor } from '@/src/features/checkin/flightHash';
import { MONO, type PassData } from './passData';

// Apple-Wallet-style boarding pass — port of iOS `BoardingPassCard`
// (BoardingPassDetailView.swift): sky→navy gradient header with the airline
// strip and big mono ident, white route block with 34pt IATA codes, dashed
// tear-line with side notches, PASSENGER/CABIN/SEAT/GROUP stub, QR block.

const INK = '#0A0F1E'; // pass-body text on white
const DIM = 'rgba(10,15,30,0.45)';
const LABEL = 'rgba(10,15,30,0.40)';
const HEADER_GRADIENT = ['#2E7CD6', '#0A2040'] as const;

/** Arrival instant — real data when the caller has it; otherwise a
 *  deterministic 1.5–9h duration hashed from the ident (demo-friendly). */
function arrivalISO(data: PassData): string | undefined {
  if (!data.departISO) return undefined;
  const dep = Date.parse(
    data.departISO.length === 10 ? `${data.departISO}T00:00:00` : data.departISO,
  );
  if (!Number.isFinite(dep)) return undefined;
  const hours = 1.5 + rngFor(data.ident, 'duration')() * 7.5;
  return new Date(dep + hours * 3_600_000).toISOString();
}

export function PassCard({
  data,
  shimmer = true,
  compact = false,
}: {
  data: PassData;
  /** Paints the looping diagonal light sweep (iOS shimmerOverlay). */
  shimmer?: boolean;
  /** Tighter layout for embedding (check-in success step). */
  compact?: boolean;
}) {
  const hasTime = Boolean(data.departISO && data.departISO.length > 10);
  const arrive = arrivalISO(data);
  const qrSize = compact ? 118 : 172;
  const iataSize = compact ? 26 : 34;

  return (
    <View style={[styles.card, shadows.float]}>
      {/* ── Airline header ── */}
      <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <View style={[styles.header, compact && { paddingVertical: 12 }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.airlineRow}>
              <View style={[styles.logoDot, { backgroundColor: data.brandColor }]} />
              <Text style={styles.airlineName} numberOfLines={1}>
                {data.airline.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.ident, compact && { fontSize: 22 }]}>{data.ident}</Text>
            {data.departISO ? (
              <Text style={styles.headerDate}>
                {formatDate(data.departISO, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).toUpperCase()}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={styles.boardingPassTag}>BOARDING PASS</Text>
            <Ionicons name="airplane" size={compact ? 18 : 22} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </LinearGradient>

      {/* ── Route block ── */}
      <View style={[styles.route, compact && { paddingVertical: 14 }]}>
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={[styles.iata, { fontSize: iataSize }]}>{data.origin}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {data.originCity || ' '}
          </Text>
          {hasTime ? <Text style={styles.time}>{formatTime(data.departISO!)}</Text> : null}
        </View>
        <View style={styles.routeMiddle}>
          <View style={styles.routeDash} />
          <Ionicons name="airplane" size={compact ? 16 : 20} color={data.brandColor} />
          <View style={styles.routeDash} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.iata, { fontSize: iataSize }]}>{data.destination}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {data.destinationCity || ' '}
          </Text>
          {hasTime && arrive ? <Text style={styles.time}>{formatTime(arrive)}</Text> : null}
        </View>
      </View>

      {/* ── Tear line ── */}
      <View style={styles.tearRow}>
        <View style={[styles.notch, { marginLeft: -9 }]} />
        <View style={styles.tearDashClip}>
          <View style={styles.tearDash} />
        </View>
        <View style={[styles.notch, { marginRight: -9 }]} />
      </View>

      {/* ── Stub: PASSENGER / CABIN / SEAT / GROUP ── */}
      <View style={[styles.stub, compact && { paddingTop: 10 }]}>
        <View style={styles.stubRow}>
          <StubCell label="PASSENGER" value={data.passenger} />
          <StubCell
            label={data.cabinEstimated ? 'CABIN (EST.)' : 'CABIN'}
            value={data.cabin}
            align="right"
          />
        </View>
        <View style={[styles.stubRow, { marginTop: compact ? 10 : 14 }]}>
          <StubCell label="SEAT" value={data.seat} big color={data.brandColor} />
          <StubCell label="GROUP" value={data.group} big align="right" />
        </View>
      </View>

      {/* ── QR block ── */}
      <View style={[styles.qrBlock, compact && { paddingBottom: 14 }]}>
        <View style={styles.qrWell}>
          <QRCode value={data.code || data.ident} size={qrSize} backgroundColor="#FFFFFF" color={INK} />
        </View>
        <Text style={styles.code}>{data.code}</Text>
        <Text style={styles.scanHint}>Scan at gate</Text>
      </View>

      {shimmer ? <Shimmer /> : null}
    </View>
  );
}

function StubCell({
  label,
  value,
  big = false,
  align = 'left',
  color = INK,
}: {
  label: string;
  value: string;
  big?: boolean;
  align?: 'left' | 'right';
  color?: string;
}) {
  const alignItems = align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <View style={{ flex: 1, alignItems, gap: 3 }}>
      <Text style={styles.stubLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.stubValue, big && styles.stubValueBig, { color }]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Shimmer — diagonal white-gradient bar sweeping across (opacity 0.18) ─────

const BAR_W = 90;

function Shimmer() {
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(-BAR_W * 2);

  useEffect(() => {
    if (width <= 0) return;
    sweep.value = -BAR_W * 2;
    sweep.value = withRepeat(
      withDelay(
        400,
        withTiming(width + BAR_W * 2, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [width, sweep]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }, { rotate: '18deg' }],
  }));

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.shimmerClip]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.shimmerBar, barStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 16,
    gap: 12,
  },
  airlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  airlineName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    flexShrink: 1,
  },
  ident: {
    color: '#FFFFFF',
    fontFamily: MONO,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 6,
  },
  headerDate: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 3,
  },
  boardingPassTag: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  // Route
  route: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  iata: { fontFamily: MONO, fontWeight: '700', color: INK, letterSpacing: 1 },
  city: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: DIM,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  time: { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: INK, marginTop: 4 },
  routeMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  routeDash: { flex: 1, height: 1, backgroundColor: 'rgba(10,15,30,0.15)' },
  // Tear line
  tearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    height: 20,
  },
  notch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.ink,
  },
  tearDashClip: { flex: 1, overflow: 'hidden', height: 1, marginHorizontal: 8 },
  tearDash: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(10,15,30,0.25)',
    height: 2,
  },
  // Stub
  stub: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: '#FFFFFF' },
  stubRow: { flexDirection: 'row', gap: 16 },
  stubLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: LABEL },
  stubValue: { fontFamily: MONO, fontSize: 14, fontWeight: '700', color: INK },
  stubValueBig: { fontSize: 24 },
  // QR
  qrBlock: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingBottom: 20,
    gap: 8,
  },
  qrWell: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,15,30,0.15)',
  },
  code: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    color: 'rgba(10,15,30,0.6)',
  },
  scanHint: { fontSize: 11, color: LABEL },
  // Shimmer
  shimmerClip: { borderRadius: 24, overflow: 'hidden' },
  shimmerBar: {
    position: 'absolute',
    top: -120,
    bottom: -120,
    width: BAR_W,
    opacity: 0.18,
  },
});

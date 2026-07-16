// Bag detail — RN port of iOS `BagDetailView.swift`: status-colored header,
// animated status visual (conveyor belt while in transit, aircraft loader
// while loading), a six-node scan timeline with deterministic timestamps, and
// Report Missing / Refresh / WorldTracer actions.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Badge, Card, palette, radii, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { formatTime } from '@/src/core/format';
import { buildTimeline } from '@/src/features/vaults/bagTimeline';
import { BAG_STATUS_META, useLuggage } from '@/src/core/store/luggage';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const VISUAL_HEIGHT = 180;
const WORLDTRACER_URL = 'https://www.worldtracer.aero/filedsp/';
const FIND_MY_URL = 'https://www.icloud.com/find';

export default function BagDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bags = useLuggage((s) => s.bags);
  const setStatus = useLuggage((s) => s.setStatus);
  const update = useLuggage((s) => s.update);

  const bag = bags.find((b) => b.id === id);
  const [refreshing, setRefreshing] = useState(false);

  const timeline = useMemo(() => (bag ? buildTimeline(bag) : []), [bag]);

  if (!bag) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Bag" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="briefcase" title="Bag not found" subtitle="It may have been removed." />
        </View>
      </Screen>
    );
  }

  const meta = BAG_STATUS_META[bag.status];
  const isMissing = bag.status === 'missing' || bag.status === 'lost';

  const reportMissing = () =>
    Alert.alert('Report bag missing?', 'Marks the bag Cannot Locate and surfaces WorldTracer next steps.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report missing', style: 'destructive', onPress: () => setStatus(bag.id, 'missing') },
    ]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    // Fake 1s trace, then stamp updatedAt so the timeline re-derives.
    setTimeout(() => {
      update({ ...bag });
      setRefreshing(false);
    }, 1000);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline={bag.tagNumber ? `Tag #${bag.tagNumber}` : 'Luggage'} title={bag.label} />

      <View style={{ gap: spacing.md }}>
        {/* ── Status header ─────────────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                backgroundColor: `${meta.color}1F`,
                borderWidth: 1,
                borderColor: `${meta.color}40`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="briefcase" size={26} color={meta.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.heading, { color: meta.color }]} numberOfLines={1}>
                {meta.label}
              </Text>
              <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
                {[bag.airline, bag.flightNumber, bag.lastLocation].filter(Boolean).join(' · ') ||
                  'No flight details on file'}
              </Text>
            </View>
            <Badge tone={meta.tone} label={meta.label} />
          </View>
        </Card>

        {isMissing ? (
          <View style={styles.missingBanner}>
            <Ionicons name="alert-circle" size={20} color={palette.bad} />
            <Text style={[type.caption, { color: palette.text, flex: 1 }]}>
              Reported missing. File a report at your airline&apos;s baggage desk — WorldTracer keeps
              the trace active across carriers.
            </Text>
          </View>
        ) : null}

        {/* ── Animated status visual ────────────────────────────────────── */}
        {bag.status === 'inTransit' ? (
          <ConveyorBeltVisual />
        ) : bag.status === 'loaded' ? (
          <AircraftLoadingVisual />
        ) : (
          <StaticStatusVisual color={meta.color} icon={meta.icon} label={meta.label} />
        )}

        {/* ── Scan timeline ─────────────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={[type.sub, { flex: 1 }]}>Scan timeline</Text>
            <Text style={type.caption}>{timeline.filter((n) => n.reached).length} of {timeline.length} scans</Text>
          </View>
          {timeline.map((node, i) => (
            <TimelineRow
              key={node.key}
              node={node}
              nextReached={timeline[i + 1]?.reached ?? false}
              last={i === timeline.length - 1}
            />
          ))}
        </Card>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <ActionButton
            label={isMissing ? 'Reported Missing' : 'Report Missing'}
            icon="warning"
            color={palette.bad}
            disabled={isMissing}
            onPress={reportMissing}
          />
          <ActionButton
            label={refreshing ? 'Refreshing…' : 'Refresh'}
            icon="refresh"
            color={palette.bright}
            disabled={refreshing}
            spinner={refreshing}
            onPress={refresh}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {bag.hasAirTag && Platform.OS === 'ios' ? (
            <ActionButton
              label="Find My"
              icon="radio"
              color={palette.bright}
              onPress={() => void WebBrowser.openBrowserAsync(FIND_MY_URL).catch(() => {})}
            />
          ) : null}
          <ActionButton
            label="WorldTracer"
            icon="globe"
            color={palette.dim}
            onPress={() => void WebBrowser.openBrowserAsync(WORLDTRACER_URL).catch(() => {})}
          />
        </View>
      </View>
    </Screen>
  );
}

// ── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({
  node,
  nextReached,
  last,
}: {
  node: ReturnType<typeof buildTimeline>[number];
  nextReached: boolean;
  last: boolean;
}) {
  const tint = node.reached ? node.color : palette.faint;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {/* Rail */}
      <View style={{ width: 28, alignItems: 'center' }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: node.reached ? `${node.color}2E` : palette.elevated2,
            borderWidth: 1,
            borderColor: node.reached ? `${node.color}66` : palette.separator,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={node.icon as never} size={13} color={tint} />
        </View>
        {!last ? (
          <View
            style={{
              width: 2,
              flex: 1,
              minHeight: 18,
              backgroundColor: nextReached ? `${node.color}59` : palette.separator,
            }}
          />
        ) : null}
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={[
              type.body,
              { flex: 1, fontWeight: '600', color: node.reached ? node.color : palette.faint },
            ]}
          >
            {node.title}
          </Text>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: node.reached ? palette.dim : palette.faint }}>
            {node.reachedAt ? formatTime(node.reachedAt.toISOString()) : '—'}
          </Text>
        </View>
        <Text style={[type.caption, { marginTop: 2, color: node.reached ? palette.dim : palette.faint }]}>
          {node.reached ? node.location : 'Awaiting scan'}
        </Text>
      </View>
    </View>
  );
}

// ── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  color,
  onPress,
  disabled,
  spinner,
}: {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  spinner?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: 12,
          borderRadius: radii.control,
          backgroundColor: `${color === palette.dim ? '#8B92A8' : color}1F`,
          borderWidth: 1,
          borderColor: `${color === palette.dim ? '#8B92A8' : color}40`,
        },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {spinner ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon as never} size={15} color={color} />
      )}
      <Text style={{ fontSize: 14, fontWeight: '600', color }}>{label}</Text>
    </Pressable>
  );
}

// ── Animated visuals ─────────────────────────────────────────────────────────

/** 0→1 looping phase driven by Reanimated (UI thread, no render-side timers). */
function useLoopPhase(duration: number) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [p, duration]);
  return p;
}

function LivePill({ text }: { text: string }) {
  const p = useLoopPhase(1600);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * Math.abs(Math.sin(p.value * Math.PI)),
  }));
  return (
    <View style={styles.livePill}>
      <Animated.View style={[styles.liveDot, dotStyle]} />
      <Text style={styles.liveText}>{text}</Text>
    </View>
  );
}

/** In transit — conveyor belt: stripes stream left while suitcases ride right. */
function ConveyorBeltVisual() {
  const [w, setW] = useState(0);
  const p = useLoopPhase(3000);
  const width = w || 320;
  const beltTop = VISUAL_HEIGHT * 0.55;

  // Stripes: shift by exactly one 32px cycle × 10 per loop → seamless wrap.
  const stripesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -((p.value * 320) % 32) }],
  }));

  const case1 = useAnimatedStyle(() => ({
    transform: [{ translateX: -48 + (width + 96) * p.value }],
  }));
  const case2 = useAnimatedStyle(() => ({
    transform: [{ translateX: -48 + (width + 96) * ((p.value + 0.5) % 1) }],
  }));

  return (
    <View style={styles.visualFrame} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <LinearGradient colors={['#0F1A2B', '#1B2942']} style={StyleSheet.absoluteFill} />

      {/* Belt deck */}
      <View style={[styles.beltDeck, { top: beltTop }]}>
        <View style={{ overflow: 'hidden', borderRadius: 9, height: 18, justifyContent: 'center' }}>
          <Animated.View style={[{ flexDirection: 'row', gap: 18, width: width + 64 }, stripesStyle]}>
            {Array.from({ length: 24 }, (_, i) => (
              <View key={i} style={styles.beltStripe} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Rollers */}
      <View style={[styles.rollerRow, { top: beltTop + 26 }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.roller} />
        ))}
      </View>

      {/* Travelling suitcases */}
      <Animated.View style={[styles.beltCase, { top: beltTop - 40 }, case1]}>
        <Ionicons name="briefcase" size={38} color="#FFFFFF" />
      </Animated.View>
      <Animated.View style={[styles.beltCase, { top: beltTop - 34 }, case2]}>
        <Ionicons name="bag-handle" size={30} color="rgba(255,255,255,0.85)" />
      </Animated.View>

      <LivePill text="LIVE — IN TRANSIT" />
    </View>
  );
}

/** Loaded — suitcases climb an angled loader into a parked aircraft. */
function AircraftLoadingVisual() {
  const [w, setW] = useState(0);
  const p = useLoopPhase(2400);
  const width = w || 320;
  const h = VISUAL_HEIGHT;

  // Ramp from bottom-left up to the aircraft door (mirrors the iOS geometry).
  const start = { x: 28, y: h * 0.8 };
  const end = { x: width * 0.55, y: h * 0.42 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const rampLen = Math.sqrt(dx * dx + dy * dy);
  const rampAngle = Math.atan2(dy, dx); // radians, negative (up-right)

  const rampDeg = (rampAngle * 180) / Math.PI;
  const climb1 = useAnimatedStyle(() => {
    const t = p.value % 1;
    return {
      transform: [
        { translateX: start.x + dx * t - 13 },
        { translateY: start.y + dy * t - 30 },
        { rotate: `${rampDeg}deg` },
      ],
      opacity: t > 0.94 ? 0 : 1,
    };
  });
  const climb2 = useAnimatedStyle(() => {
    const t = (p.value + 0.5) % 1;
    return {
      transform: [
        { translateX: start.x + dx * t - 13 },
        { translateY: start.y + dy * t - 30 },
        { rotate: `${rampDeg}deg` },
      ],
      opacity: t > 0.94 ? 0 : 1,
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.45 * Math.abs(Math.sin(p.value * Math.PI * 2)),
  }));

  return (
    <View style={styles.visualFrame} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <LinearGradient colors={['#241A3E', '#3D2A5C']} style={StyleSheet.absoluteFill} />

      {/* Tarmac */}
      <View style={styles.tarmac} />

      {/* Loader ramp (rotated bar spanning start→end) */}
      <View
        style={[
          styles.ramp,
          {
            width: rampLen,
            left: (start.x + end.x) / 2 - rampLen / 2,
            top: (start.y + end.y) / 2 - 6,
            transform: [{ rotate: `${(rampAngle * 180) / Math.PI}deg` }],
          },
        ]}
      />
      {/* Support legs */}
      <View style={[styles.rampLeg, { left: start.x + 34, top: start.y - 4, height: h * 0.92 - start.y }]} />
      <View
        style={[
          styles.rampLeg,
          { left: (start.x + end.x) / 2, top: (start.y + end.y) / 2, height: h * 0.92 - (start.y + end.y) / 2 },
        ]}
      />

      {/* Aircraft */}
      <View style={{ position: 'absolute', left: width * 0.78 - 45, top: h * 0.42 - 45 }}>
        <Ionicons name="airplane" size={90} color="#FFFFFF" style={{ transform: [{ rotate: '-12deg' }] }} />
      </View>

      {/* Cargo-door glow */}
      <Animated.View style={[styles.doorGlow, { left: end.x - 16, top: end.y - 16 }, glowStyle]} />

      {/* Climbing suitcases */}
      <Animated.View style={[styles.climbCase, climb1]}>
        <Ionicons name="briefcase" size={26} color="#FFFFFF" />
      </Animated.View>
      <Animated.View style={[styles.climbCase, climb2]}>
        <Ionicons name="bag-handle" size={22} color="rgba(255,255,255,0.9)" />
      </Animated.View>

      <LivePill text="LOADING AIRCRAFT" />
    </View>
  );
}

/** Everything else — static status wash with the big icon (iOS parity). */
function StaticStatusVisual({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <View style={styles.visualFrame}>
      <LinearGradient
        colors={[`${color}D9`, `${color}8C`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <Ionicons name={icon as never} size={54} color="#FFFFFF" />
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  missingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: 'rgba(255,92,92,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,92,0.30)',
  },
  visualFrame: {
    height: VISUAL_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  livePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(6,7,13,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B9EF0' },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#FFFFFF' },
  beltDeck: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2A3B5A',
  },
  beltStripe: { width: 14, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  rollerRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  roller: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#4A5C7E' },
  beltCase: {
    position: 'absolute',
    left: 0,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tarmac: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: VISUAL_HEIGHT * 0.22,
    backgroundColor: '#1A1230',
  },
  ramp: { position: 'absolute', height: 12, borderRadius: 4, backgroundColor: 'rgba(123,63,191,0.85)' },
  rampLeg: { position: 'absolute', width: 3, backgroundColor: '#5A2E8E' },
  doorGlow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(29,185,125,0.55)',
  },
  climbCase: {
    position: 'absolute',
    left: 0,
    top: 0,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
});

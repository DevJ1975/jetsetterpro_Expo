import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import type { DisruptionEvent, DisruptionKind } from '@/src/core/api/disruptions';

// Airport-style scrolling ticker for live flight changes. Yellow for gate
// changes and delays; RED for cancellations/diversions. Continuously scrolls
// (reduce-motion → static, non-scrolling). Taps through to the disruption
// dashboard. Renders nothing when there are no active flight-change alerts.

const KIND_LABEL: Record<DisruptionKind, string> = {
  GATE_CHANGE: 'GATE CHANGE',
  DELAY: 'DELAYED',
  CANCELLED: 'CANCELLED',
  DIVERTED: 'DIVERTED',
};

const SEVERE: DisruptionKind[] = ['CANCELLED', 'DIVERTED'];

export function FlightAlertMarquee({ events }: { events: DisruptionEvent[] }) {
  const router = useRouter();
  const reduce = useReduceMotion();
  const [trackW, setTrackW] = useState(0);
  const x = useSharedValue(0);

  const flight = events.filter((e) => e.kind in KIND_LABEL);
  const severe = flight.some((e) => SEVERE.includes(e.kind));

  const message = flight
    .map((e) => `${KIND_LABEL[e.kind] ?? 'ALERT'}: ${e.title}${e.message ? ` — ${e.message}` : ''}`)
    .join('      ✦      ');

  useEffect(() => {
    if (reduce || trackW === 0) {
      x.value = 0;
      return;
    }
    // Scroll one full track width then wrap; a duplicate copy makes it seamless.
    x.value = 0;
    const pxPerSec = 45;
    x.value = withRepeat(
      withTiming(-trackW, { duration: (trackW / pxPerSec) * 1000, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(x);
  }, [reduce, trackW, x, message]);

  const scroll = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (flight.length === 0) return null;

  const tint = severe ? '#FF5C5C' : '#E8A020';
  const bg = severe ? 'rgba(255,92,92,0.16)' : 'rgba(232,160,32,0.16)';

  return (
    <Pressable
      onPress={() => router.push('/disruption')}
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={[styles.bar, { backgroundColor: bg, borderColor: severe ? 'rgba(255,92,92,0.4)' : 'rgba(232,160,32,0.4)' }]}
    >
      <View style={[styles.tag, { backgroundColor: tint }]}>
        <Ionicons name={severe ? 'close-circle' : 'warning'} size={13} color="#04101F" />
      </View>
      <View style={styles.viewport}>
        {reduce ? (
          <Text style={[styles.text, { color: tint }]} numberOfLines={1}>
            {message}
          </Text>
        ) : (
          <Animated.View style={[styles.row, scroll]}>
            <Text
              style={[styles.text, { color: tint }]}
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width + 48)}
            >
              {message}
            </Text>
            {/* Seamless-loop duplicate. */}
            <Text style={[styles.text, { color: tint, marginLeft: 48 }]}>{message}</Text>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tag: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: { flex: 1, overflow: 'hidden', paddingLeft: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});

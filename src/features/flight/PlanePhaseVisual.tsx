// Animated flight-phase scene — a modest RN take on the iOS
// `FlightPhaseAnimationView` (Canvas + TimelineView): a plane icon loops along
// a phase-appropriate arc over a soft accent wash, with a runway strip on
// ground phases and drifting clouds aloft, plus the phase capsule badge.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '@/src/ui';

const PLANE = 30;

/** Slow right→left drift, wrapping with margin, phase-offset per cloud. */
function useCloudStyle(
  p: { value: number },
  w: number,
  offset: number,
  top: number,
) {
  return useAnimatedStyle(() => {
    const width = w || 320;
    const t = (p.value + offset) % 1;
    return { transform: [{ translateX: width * (1.05 - 1.35 * t) }, { translateY: top }] };
  });
}

export function PlanePhaseVisual({ label, height = 170 }: { label: string; height?: number }) {
  const [w, setW] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [p]);

  const grounded = label === 'Taxi & Takeoff';

  const planeStyle = useAnimatedStyle(() => {
    const t = p.value;
    const width = w || 320;
    const groundY = height - 42;
    let x = width * 0.5;
    let y = height * 0.32;
    let rot = 0;
    if (label === 'Taxi & Takeoff') {
      const lift = t > 0.7 ? (t - 0.7) / 0.3 : 0;
      x = width * (0.08 + 0.72 * t);
      y = groundY - lift * 20;
      rot = -14 * lift;
    } else if (label === 'Climb') {
      x = width * (0.1 + 0.7 * t);
      y = height * (0.78 - 0.52 * t);
      rot = -20;
    } else if (label === 'Cruise') {
      x = width * 0.5 + Math.sin(t * Math.PI * 2) * width * 0.06;
      y = height * 0.32 + Math.sin(t * Math.PI * 4) * 4;
      rot = 0;
    } else if (label === 'Descent') {
      x = width * (0.15 + 0.68 * t);
      y = height * (0.3 + 0.45 * t);
      rot = 17;
    } else {
      // Final approach — steeper, lower glide to the threshold.
      x = width * (0.2 + 0.62 * t);
      y = height * (0.42 + 0.4 * t);
      rot = 15;
    }
    return {
      transform: [
        { translateX: x - PLANE / 2 },
        { translateY: y - PLANE / 2 },
        { rotate: `${rot}deg` },
      ],
    };
  });

  const cloud1 = useCloudStyle(p, w, 0, height * 0.18);
  const cloud2 = useCloudStyle(p, w, 0.4, height * 0.5);
  const cloud3 = useCloudStyle(p, w, 0.75, height * 0.68);

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityLabel={`Flight phase: ${label}`}
    >
      <LinearGradient
        colors={['rgba(59,158,240,0.12)', 'rgba(59,158,240,0.0)']}
        style={StyleSheet.absoluteFill}
      />

      {grounded ? (
        <View style={[styles.runway, { top: height - 26 }]}>
          <View style={styles.centerline} />
        </View>
      ) : (
        <>
          <Animated.View style={[styles.cloud, { width: 46, height: 18 }, cloud1]} />
          <Animated.View style={[styles.cloud, { width: 32, height: 13 }, cloud2]} />
          <Animated.View style={[styles.cloud, { width: 55, height: 22 }, cloud3]} />
        </>
      )}

      <Animated.View style={[styles.plane, planeStyle]}>
        <Ionicons name="airplane" size={PLANE} color="#FFFFFF" />
      </Animated.View>

      <View style={styles.badge}>
        <Ionicons name="airplane" size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  runway: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: 'rgba(59,158,240,0.12)',
    justifyContent: 'center',
  },
  centerline: {
    marginHorizontal: 12,
    borderTopWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
  },
  cloud: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  plane: {
    position: 'absolute',
    width: PLANE,
    height: PLANE,
    shadowColor: palette.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(59,158,240,0.85)',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});

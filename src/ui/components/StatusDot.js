import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { palette } from '../theme';

/** Pulsing live-status dot. tone: 'good' | 'warn' | 'bad' | 'accent'.
 * Reanimated shared value drives the expanding halo; snaps to a static dot
 * under Reduce Motion or when `pulse` is off. */
export default function StatusDot({ tone = 'good', size = 8, pulse = true }) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  const active = pulse && !reduce;

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [active, progress]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.28, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1]) }],
  }));

  const color =
    { good: palette.good, warn: palette.warn, bad: palette.bad, accent: palette.accent }[tone] ||
    palette.good;

  return (
    <View
      style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: color }, haloStyle]}
      />
      <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

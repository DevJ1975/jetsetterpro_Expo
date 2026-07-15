import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { gradients } from '../theme';
import { useReduceMotion } from '@/src/core/useReduceMotion';

/** Clamp a progress value into [0,1]; NaN/non-finite → 0 (guards 'NaN%' width). */
export function clampProgress(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Flight-progress style bar. value: 0..1. Fills the brand gradient and
 *  animates to new values with a spring (snaps under Reduce Motion). */
export default function ProgressBar({ value = 0, height = 6, style }) {
  const pct = clampProgress(value);
  const reduce = useReduceMotion();
  const w = useSharedValue(pct);

  useEffect(() => {
    w.value = reduce ? pct : withSpring(pct, { damping: 18, stiffness: 140 });
  }, [pct, reduce, w]);

  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: 'rgba(59,158,240,0.15)', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius: height / 2, overflow: 'hidden' }, fill]}>
        <LinearGradient
          colors={gradients.progress}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

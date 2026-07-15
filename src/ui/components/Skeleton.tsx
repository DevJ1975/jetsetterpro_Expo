import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { DimensionValue, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { palette } from '../theme';

/**
 * Shimmer placeholder block — a light sweep over a dim fill (reuses the
 * boarding-pass sweep idea) so async screens load with shaped skeletons instead
 * of a bare spinner. Honors Reduce Motion (renders a static dim block).
 * Compose several to mirror the shape of the content that's loading.
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  radius = 10,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce || w === 0) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [reduce, w, progress]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -w + progress.value * (2 * w) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: palette.elevated2, overflow: 'hidden' }, style]}
    >
      {!reduce && w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

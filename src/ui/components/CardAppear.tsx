import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';

/**
 * Fade + slide-up entrance — port of iOS `.cardAppear(delay:)`. Wrap Home
 * cards so the screen "blooms" into view with a stagger. Honors Reduce Motion
 * (snaps to the final state).
 */
export default function CardAppear({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  /** Seconds, matching the iOS modifier. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const visible = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      visible.value = 1;
      return;
    }
    // iOS: .spring(response: 0.55, dampingFraction: 0.85)
    visible.value = withDelay(delay * 1000, withSpring(1, { damping: 18, stiffness: 140 }));
  }, [delay, visible, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 18 }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

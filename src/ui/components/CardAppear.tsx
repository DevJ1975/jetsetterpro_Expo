import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

/**
 * Fade + slide-up entrance — port of iOS `.cardAppear(delay:)`. Wrap Home
 * cards so the screen "blooms" into view with a stagger.
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

  useEffect(() => {
    // iOS: .spring(response: 0.55, dampingFraction: 0.85)
    visible.value = withDelay(delay * 1000, withSpring(1, { damping: 18, stiffness: 140 }));
  }, [delay, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 18 }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

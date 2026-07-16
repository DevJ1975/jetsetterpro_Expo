import React from 'react';
import {
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { haptics, type HapticKind } from '@/src/core/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that springs down on touch (scale + slight dim) and optionally
 * fires a haptic — the shared tactile primitive so every tap in the app
 * responds. Drop-in for a plain `<Pressable>` with a static (non-function)
 * style. Honors Reduce Motion implicitly (a 90ms scale is imperceptible under
 * it; the haptic still fires, which is correct).
 */
export default function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  dimTo = 0.9,
  haptic,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale at full press (default 0.97). */
  scaleTo?: number;
  /** Opacity at full press (default 0.9). */
  dimTo?: number;
  /** Haptic to fire on press-in (skipped when disabled). */
  haptic?: HapticKind;
  children?: React.ReactNode;
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * (1 - dimTo),
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        pressed.value = withTiming(1, { duration: 90 });
        if (haptic && !disabled) haptics.fire(haptic);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        pressed.value = withTiming(0, { duration: 140 });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

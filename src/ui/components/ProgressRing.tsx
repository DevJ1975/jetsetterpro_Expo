import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring — the iOS packing-list ring (trimmed stroked Circle,
 * round caps, spring-animated, green at 100%). Center content renders as
 * children.
 */
export default function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 10,
  color,
  trackColor = palette.elevated2,
  children,
  style,
}: {
  /** 0…1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Defaults to accent, or success when complete — like iOS. */
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const tint = color ?? (clamped >= 1 ? palette.good : palette.accent);

  const animated = useSharedValue(clamped);
  useEffect(() => {
    // iOS: .animation(.spring(response: 0.5))
    animated.value = withSpring(clamped, { damping: 16, stiffness: 160 });
  }, [clamped, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tint}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={ringCenter}>{children}</View> : null}
    </View>
  );
}

const ringCenter: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
};

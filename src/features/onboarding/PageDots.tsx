import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { palette } from '@/src/ui';

/**
 * Capsule page-dot indicator — port of the iOS onboarding dots: the active
 * dot elongates to a 24pt accent capsule with a spring; inactive dots are
 * 6pt white-dim circles.
 */
export function PageDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 24 : 6);

  useEffect(() => {
    // iOS: .spring(response 0.4, damping 0.7)
    width.value = withSpring(active ? 24 : 6, { damping: 15, stiffness: 220 });
  }, [active, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

  return <Animated.View style={[styles.dot, active && styles.dotActive, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: palette.accent,
  },
});

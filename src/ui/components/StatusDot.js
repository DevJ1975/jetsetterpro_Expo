import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { palette } from '../theme';

/** Pulsing live-status dot. tone: 'good' | 'warn' | 'bad' | 'accent' */
export default function StatusDot({ tone = 'good', size = 8, pulse = true }) {
  // A stable Animated.Value held in state (not a ref) so it can be read in render.
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, a]);
  const color = { good: palette.good, warn: palette.warn, bad: palette.bad, accent: palette.accent }[tone] || palette.good;
  return (
    <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]} />
      <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

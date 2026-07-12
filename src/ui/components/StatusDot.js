import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { palette } from '../theme';

/** Pulsing live-status dot. tone: 'good' | 'warn' | 'bad' | 'accent' */
export default function StatusDot({ tone = 'good', size = 8, pulse = true }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const color = { good: palette.good, warn: palette.warn, bad: palette.bad, accent: palette.accent }[tone] || palette.good;
  return (
    <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]} />
      <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

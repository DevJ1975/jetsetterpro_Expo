import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Star field backdrop — port of the iOS onboarding `StarFieldView` (60 white
 * dots, random position/size/opacity). A few stars twinkle gently; positions
 * come from a seeded PRNG so renders are deterministic.
 */
type Star = { x: number; y: number; size: number; opacity: number; twinkle: boolean };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function StarField({ count = 60, seed = 7 }: { count?: number; seed?: number }) {
  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: rand(),
      y: rand(),
      size: 1 + rand() * 1.5,
      opacity: 0.1 + rand() * 0.4,
      twinkle: i % 4 === 0,
    }));
  }, [count, seed]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) =>
        star.twinkle ? (
          <TwinklingStar key={i} star={star} periodMs={2000 + (i % 5) * 400} />
        ) : (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${star.x * 100}%`,
              top: `${star.y * 100}%`,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              backgroundColor: `rgba(255,255,255,${star.opacity})`,
            }}
          />
        ),
      )}
    </View>
  );
}

function TwinklingStar({ star, periodMs }: { star: Star; periodMs: number }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: periodMs }), -1, true);
  }, [periodMs, phase]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: star.opacity * (0.35 + 0.65 * phase.value),
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${star.x * 100}%`,
          top: `${star.y * 100}%`,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: '#FFFFFF',
        },
        animatedStyle,
      ]}
    />
  );
}

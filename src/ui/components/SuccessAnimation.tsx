import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Success overlay — port of iOS `SuccessAnimationView.swift`: dim/blur
 * backdrop, springy green circle with a path-drawn checkmark, 10 confetti
 * particles floating up, title/subtitle/optional monospaced reference, and
 * auto-dismiss after 2.5s or on tap. Mount conditionally over the screen.
 */
export default function SuccessAnimation({
  title,
  subtitle,
  referenceNumber,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  referenceNumber?: string | null;
  onDismiss: () => void;
}) {
  const circle = useSharedValue(0.2);
  const check = useSharedValue(0);
  const textIn = useSharedValue(0);
  const confetti = useSharedValue(0);
  const dismissed = useRef(false);

  // Seeded PRNG keeps render pure (react-compiler) — the scatter still reads
  // as random; iOS re-rolls per appearance but identical confetti per show is
  // imperceptible.
  const particles = useMemo(() => {
    const rand = mulberry32(0xc0ffee);
    return Array.from({ length: 10 }, () => ({
      color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
      w: 5 + rand() * 3,
      h: 9 + rand() * 5,
      offsetX: -120 + rand() * 240,
      drift: rand() * 80,
      wobbleFreq: 0.6 + rand() * 0.8,
      wobbleAmp: 8 + rand() * 20,
      rotationSpeed: 180 + rand() * 360,
    }));
  }, []);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismiss();
  };

  useEffect(() => {
    // iOS: spring(response 0.4, damping 0.65) → pop the circle in
    circle.value = withSpring(1, { damping: 12, stiffness: 190 });
    check.value = withDelay(180, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    textIn.value = withDelay(350, withTiming(1, { duration: 400 }));
    confetti.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(dismiss, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circle.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textIn.value }));
  // Checkmark path ≈ 48×36 polyline; total length ≈ 78.
  const CHECK_LENGTH = 78;
  const animatedCheck = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - check.value),
  }));

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      {/* Confetti */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p, i) => (
          <ConfettiPiece key={i} particle={p} progress={confetti} />
        ))}
      </View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={[styles.badge, circleStyle]}>
          <Svg width={48} height={36} viewBox="0 0 48 36">
            <AnimatedPath
              d="M 1 20 L 18.24 35 L 47 2.8"
              stroke="#FFFFFF"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${78} ${78}`}
              animatedProps={animatedCheck}
            />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.textBlock, textStyle]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {referenceNumber ? (
            <View style={styles.refPill}>
              <Text style={styles.refText}>{referenceNumber}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

function ConfettiPiece({
  particle,
  progress,
}: {
  particle: {
    color: string;
    w: number;
    h: number;
    offsetX: number;
    drift: number;
    wobbleFreq: number;
    wobbleAmp: number;
    rotationSpeed: number;
  };
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const eased = progress.value; // withTiming already eased
    return {
      opacity: 1 - eased,
      transform: [
        { translateX: particle.offsetX + Math.sin(eased * Math.PI * 2 * particle.wobbleFreq) * particle.wobbleAmp },
        { translateY: 40 - (140 + particle.drift) * eased },
        { rotate: `${eased * particle.rotationSpeed}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.confetti,
        { width: particle.w, height: particle.h, backgroundColor: particle.color },
        style,
      ]}
    />
  );
}

const CONFETTI_COLORS = [
  '#34C759', '#FFD60A', '#FF9F0A', '#FF6482', '#3B9EF0', '#BF5AF2', '#63E6E2', '#40C8E0',
];

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

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  textBlock: { alignItems: 'center', marginTop: 18, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  refPill: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  refText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  confetti: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 1.5,
  },
});

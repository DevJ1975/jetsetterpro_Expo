import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fonts, palette } from '../theme';

/**
 * Animated launch splash — port of iOS `SplashScreenView.swift`: radial glow,
 * spring-in airplane badge, a plane flying edge-to-edge that reveals the
 * gradient wordmark in its wake, kicker + EST line, then a fade-out
 * (~1.5s total; Reduce Motion skips the fly-through). Render over the app
 * root; `onDone` fires when fully faded.
 */
export default function Splash({ onDone }: { onDone: () => void }) {
  const { width: sw, height: sh } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const icon = useSharedValue(0);
  const plane = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const view = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => mounted && setReduceMotion(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    if (reduceMotion) {
      icon.value = 1;
      plane.value = 1;
      subtitle.value = 1;
      after(900, () => {
        view.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) });
      });
      after(1250, onDone);
    } else {
      after(80, () => {
        icon.value = withSpring(1, { damping: 13, stiffness: 160 });
      });
      after(280, () => {
        plane.value = withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) });
      });
      after(780, () => {
        subtitle.value = withTiming(1, { duration: 700 });
      });
      after(1150, () => {
        view.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) });
      });
      after(1500, onDone);
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const viewStyle = useAnimatedStyle(() => ({ opacity: view.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: icon.value,
    transform: [{ scale: 0.2 + icon.value * 0.8 }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitle.value }));
  // Wordmark reveal: a window that grows with the plane's x position.
  const revealStyle = useAnimatedStyle(() => {
    const planeX = -80 + plane.value * (sw + 160);
    return { width: Math.max(0, planeX - 50) };
  });
  const planeStyle = useAnimatedStyle(() => {
    const p = plane.value;
    const planeX = -80 + p * (sw + 160);
    return {
      opacity: Math.min(1, Math.min(p * 30, (1 - p) * 30)),
      transform: [{ translateX: planeX }, { translateY: sh * 0.505 }, { rotate: '-45deg' }],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, viewStyle]} pointerEvents="auto">
      {/* Radial glow centered on screen */}
      <Svg width={sw} height={sh} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadialGradient id="glow" cx="50%" cy="50%" r="60%">
            <Stop offset="0" stopColor={palette.accent} stopOpacity={0.1} />
            <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Circle cx={sw / 2} cy={sh / 2} r={sw * 0.85} fill="url(#glow)" />
      </Svg>

      <View style={styles.centerColumn}>
        {/* Circular icon badge */}
        <Animated.View style={[styles.badge, iconStyle]}>
          <Ionicons
            name="airplane"
            size={38}
            color={palette.accent}
            style={{ transform: [{ rotate: '-45deg' }] }}
          />
        </Animated.View>

        {/* Wordmark revealed by the plane's wake */}
        <View style={{ height: 58, marginTop: 20, width: sw, alignItems: 'flex-start' }}>
          <Animated.View style={[{ overflow: 'hidden', height: 58 }, revealStyle]}>
            <Svg width={sw} height={58}>
              <Defs>
                <SvgLinearGradient id="wordmark" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={palette.accent} />
                  <Stop offset="0.55" stopColor={palette.accent} stopOpacity={0.88} />
                  <Stop offset="1" stopColor="#A8D8FF" />
                </SvgLinearGradient>
              </Defs>
              <SvgText
                x={sw / 2}
                y={44}
                fontSize={44}
                fontFamily={fonts.rounded.extrabold}
                fill="url(#wordmark)"
                textAnchor="middle"
              >
                JetSetter Pro
              </SvgText>
            </Svg>
          </Animated.View>
        </View>

        <Animated.Text style={[styles.kicker, subtitleStyle]}>
          YOUR EXECUTIVE TRAVEL COMPANION
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.est, subtitleStyle]}>EST. 2025</Animated.Text>

      {/* Flying airplane — travels edge-to-edge */}
      <Animated.View style={[styles.plane, planeStyle]} pointerEvents="none">
        <Ionicons name="airplane" size={26} color={palette.accent} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#10131E', zIndex: 1000 },
  centerColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,158,240,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,158,240,0.30)',
  },
  kicker: {
    marginTop: 20,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3.5,
    color: '#8B92A8',
  },
  est: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 5,
    color: 'rgba(59,158,240,0.40)',
  },
  plane: {
    position: 'absolute',
    top: 0,
    left: 0,
    shadowColor: '#3B9EF0',
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});

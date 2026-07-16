import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/src/core/useReduceMotion';
import { weatherVisual } from './weatherVisual';

// Live-condition weather animation for the header. The motion is chosen from the
// WMO code — the sun rotates, clouds drift, rain/snow bob with falling drops,
// storms flash. Reduce-motion gated: it renders the plain symbol (identical to
// the static chip) when the user prefers reduced motion.

type Motion = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';

function motionFor(code: number): Motion {
  if (code === 0 || code === 1) return 'sun';
  if (code >= 95) return 'storm';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 51) return 'rain';
  return 'cloud'; // 2, 3, 45, 48
}

export function AnimatedWeatherIcon({ code, size = 26 }: { code: number; size?: number }) {
  const reduce = useReduceMotion();
  const { icon, color } = weatherVisual(code);
  const motion = motionFor(code);

  const spin = useSharedValue(0);
  const drift = useSharedValue(0);
  const bob = useSharedValue(0);
  const flash = useSharedValue(1);
  const fall = useSharedValue(0);

  useEffect(() => {
    const stopAll = () => {
      for (const v of [spin, drift, bob, flash, fall]) cancelAnimation(v);
      spin.value = 0;
      drift.value = 0;
      bob.value = 0;
      fall.value = 0;
      flash.value = 1;
    };
    // useReduceMotion resolves asynchronously (starts false), so motion may have
    // begun on the first pass — cancel + reset it when reduce becomes true.
    if (reduce) {
      stopAll();
      return;
    }
    const loop = (v: typeof spin, to: number, dur: number, seq = false) => {
      v.value = seq
        ? withRepeat(withSequence(withTiming(to, { duration: dur }), withTiming(0, { duration: dur })), -1)
        : withRepeat(withTiming(to, { duration: dur, easing: Easing.linear }), -1);
    };
    if (motion === 'sun') loop(spin, 1, 9000);
    if (motion === 'cloud') loop(drift, 1, 2600, true);
    if (motion === 'rain' || motion === 'snow') {
      loop(bob, 1, 1400, true);
      fall.value = withRepeat(withTiming(1, { duration: motion === 'snow' ? 1600 : 900, easing: Easing.in(Easing.quad) }), -1);
    }
    if (motion === 'storm') {
      flash.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 120 }),
          withTiming(1, { duration: 140 }),
          withTiming(1, { duration: 1400 }),
        ),
        -1,
      );
    }
    return stopAll; // cancel loops on unmount / motion change
  }, [reduce, motion, spin, drift, bob, flash, fall]);

  const iconStyle = useAnimatedStyle(() => {
    if (motion === 'sun') return { transform: [{ rotate: `${spin.value * 360}deg` }] };
    if (motion === 'cloud') return { transform: [{ translateX: (drift.value - 0.5) * 6 }] };
    if (motion === 'rain' || motion === 'snow') return { transform: [{ translateY: (bob.value - 0.5) * 3 }] };
    if (motion === 'storm') return { opacity: flash.value };
    return {};
  });

  // Two falling drops/flakes behind the symbol for precipitation (staggered).
  const drop1 = useAnimatedStyle(() => {
    const p = fall.value % 1;
    return { opacity: 1 - p, transform: [{ translateY: p * size }] };
  });
  const drop2 = useAnimatedStyle(() => {
    const p = (fall.value + 0.5) % 1;
    return { opacity: 1 - p, transform: [{ translateY: p * size }] };
  });

  const showPrecip = !reduce && (motion === 'rain' || motion === 'snow');
  const dropColor = motion === 'snow' ? '#DDE7F5' : '#5BBAFF';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {showPrecip ? (
        <>
          <Animated.View
            style={[{ position: 'absolute', left: size * 0.28, top: 0, width: 3, height: 3, borderRadius: 2, backgroundColor: dropColor }, drop1]}
          />
          <Animated.View
            style={[{ position: 'absolute', left: size * 0.62, top: 0, width: 3, height: 3, borderRadius: 2, backgroundColor: dropColor }, drop2]}
          />
        </>
      ) : null}
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

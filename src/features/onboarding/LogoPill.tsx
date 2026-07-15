import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { fonts, palette, radii } from '@/src/ui';
import { GoldGradientText } from './GoldGradientText';

/**
 * Animated brand pill at the top of onboarding — port of iOS
 * `OnboardingView.logoHeader`: capsule with the airplane mark and the
 * gold-gradient "JETSETTER PRO" wordmark, springing in (scale 0.8→1, fade).
 */
export function LogoPill() {
  const appear = useSharedValue(0);

  useEffect(() => {
    // iOS: .spring(response 0.8, damping 0.7).delay(0.2)
    appear.value = withDelay(200, withSpring(1, { damping: 14, stiffness: 120 }));
  }, [appear]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.8 + appear.value * 0.2 }],
  }));

  return (
    <Animated.View style={[styles.pill, animatedStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name="airplane" size={13} color={palette.champagne} />
      </View>
      <GoldGradientText
        text="JETSETTER PRO"
        fontSize={13}
        fontFamily={fonts.rounded.extrabold}
        letterSpacing={3}
        width={168}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,158,240,0.30)',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.fillAccent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineStrong,
  },
});

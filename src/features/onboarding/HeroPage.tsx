import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { fonts, palette, type } from '@/src/ui';
import { GoldGradientText } from './GoldGradientText';
import type { HeroPageContent } from './content';

/**
 * One hero page of the onboarding carousel — port of iOS
 * `OnboardingPageContent`: layered circle glow behind a gold glyph, a
 * gold-gradient kicker, rounded hero title, and dim body copy. The glyph
 * springs in each time the page becomes active (iOS onAppear/onDisappear).
 */
export function HeroPage({
  page,
  width,
  active,
}: {
  page: HeroPageContent;
  width: number;
  active: boolean;
}) {
  const appear = useSharedValue(0);

  useEffect(() => {
    if (active) {
      appear.value = 0;
      appear.value = withDelay(120, withSpring(1, { damping: 13, stiffness: 140 }));
    }
  }, [active, appear]);

  const glyphStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.7 + appear.value * 0.3 }],
  }));

  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.glyphStack, glyphStyle]}>
        <View style={styles.glowOuter} />
        <View style={styles.glowInner} />
        <Ionicons name={page.icon} size={52} color={palette.champagne} />
      </Animated.View>

      <GoldGradientText
        text={page.kicker}
        fontSize={11}
        fontFamily={fonts.rounded.extrabold}
        letterSpacing={2.5}
        width={width - 64}
      />

      <Text style={[type.display, styles.title]}>{page.title}</Text>
      <Text style={styles.subtitle}>{page.subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  glyphStack: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(59,158,240,0.06)',
  },
  glowInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59,158,240,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59,158,240,0.25)',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 16,
  },
});

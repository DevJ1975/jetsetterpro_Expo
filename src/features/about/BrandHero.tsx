import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';
import { fonts, palette, spacing } from '@/src/ui';
import { GoldGradientText } from '@/src/features/onboarding/GoldGradientText';

/**
 * About brand hero — port of iOS `AboutView.heroSection`: radial-glow airplane
 * badge (SVG radial gradient, like Splash), gold-gradient wordmark, kicker,
 * and the app version.
 */
export function BrandHero() {
  const version = Constants.nativeApplicationVersion ?? '1.0.0';
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Svg width={96} height={96}>
          <Defs>
            <SvgRadialGradient id="aboutGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={palette.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={palette.accent} stopOpacity={0.04} />
            </SvgRadialGradient>
          </Defs>
          <Circle cx={48} cy={48} r={48} fill="url(#aboutGlow)" />
          <Circle cx={48} cy={48} r={47} stroke="rgba(59,158,240,0.35)" strokeWidth={1.5} fill="none" />
        </Svg>
        <View style={styles.badgeIcon}>
          <Ionicons
            name="airplane"
            size={40}
            color={palette.accent}
            style={{ transform: [{ rotate: '-45deg' }] }}
          />
        </View>
      </View>

      <GoldGradientText
        text="JetSetter Pro"
        fontSize={34}
        fontFamily={fonts.rounded.bold}
        width={280}
        height={46}
      />

      <Text style={styles.kicker}>YOUR EXECUTIVE TRAVEL COMPANION</Text>
      <Text style={styles.version}>Version {version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  badge: {
    width: 96,
    height: 96,
  },
  badgeIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    color: palette.dim,
  },
  version: {
    fontSize: 12,
    color: palette.faint,
  },
});

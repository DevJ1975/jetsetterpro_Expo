import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { gradients, palette, radii, shadows, spacing } from '../theme';

/**
 * The JetSetter card — a port of iOS `.jetCard()` (JetsetterTheme.swift):
 * ultra-thin-material glass fill, accent/gold gradient edge (0.6pt), inner
 * white glow, deep soft shadow, continuous 18pt corners.
 *
 * iOS gets a real BlurView under the tint (≈ .ultraThinMaterial). Android
 * renders the translucent tint alone — over the app's static hero gradient the
 * result is visually equivalent, without the cost of Android's view-hierarchy
 * blur (dimezis) for every card in a scroll view.
 *
 * variant: 'glass' (default — the iOS card) | 'solid' (opaque, long lists) |
 *          'outline'
 */
export default function Card({ children, variant = 'glass', style }) {
  if (variant === 'outline') {
    return <View style={[styles.outline, style]}>{children}</View>;
  }
  const glass = variant !== 'solid';
  return (
    <LinearGradient
      colors={gradients.cardBorder}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.border, shadows.card, style]}
    >
      <View style={styles.clip}>
        {glass && Platform.OS === 'ios' ? (
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: glass ? FILL_GLASS : palette.surface },
          ]}
        />
        <LinearGradient
          colors={gradients.cardInnerGlow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </LinearGradient>
  );
}

// iOS: lighter tint so the blur reads through (≈ ultraThinMaterial); Android:
// the design kit's glass tone carries the look on its own.
const FILL_GLASS = Platform.OS === 'ios' ? 'rgba(22,25,41,0.60)' : palette.surfaceGlass;

const styles = StyleSheet.create({
  border: { borderRadius: radii.card, padding: 0.6 },
  clip: { borderRadius: radii.card - 0.6, overflow: 'hidden' },
  content: { padding: spacing.lg },
  outline: {
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'transparent',
  },
});

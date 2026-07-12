import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette, radii, shadows, spacing } from '../theme';

/** variant: 'solid' (default) | 'glass' | 'outline' */
export default function Card({ children, variant = 'solid', style }) {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.card, padding: spacing.lg, borderWidth: 1, borderColor: palette.line, ...shadows.card },
  solid: { backgroundColor: palette.surface },
  glass: { backgroundColor: palette.surfaceGlass },
  outline: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
});

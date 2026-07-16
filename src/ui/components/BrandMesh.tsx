import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { MeshGradientView } from 'expo-mesh-gradient';
import { palette } from '@/src/ui/theme/colors';

// Decorative animated brand mesh gradient (SDK 57 expo-mesh-gradient, iOS).
// Purely additive eye-candy: on Android it renders nothing so existing
// backgrounds are untouched. Layer it behind content (absolute fill) with a low
// opacity. A 3×3 mesh of the brand blues gives a soft aurora.
const COLS = 3;
const ROWS = 3;

// 3×3 grid of points spanning the unit square.
const POINTS: number[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => [c / (COLS - 1), r / (ROWS - 1)]),
).flat();

const COLORS = [
  palette.ink, palette.elevated, palette.ink,
  palette.elevated2, palette.accent, palette.elevated2,
  palette.ink, palette.elevated, palette.ink,
];

export function BrandMesh({ style, opacity = 0.55, ...rest }: ViewProps & { opacity?: number }) {
  if (Platform.OS !== 'ios') return null;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }, style]} pointerEvents="none" {...rest}>
      <MeshGradientView
        style={StyleSheet.absoluteFill}
        columns={COLS}
        rows={ROWS}
        points={POINTS}
        colors={COLORS}
        smoothsColors
      />
    </View>
  );
}

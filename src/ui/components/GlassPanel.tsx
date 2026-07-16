import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// Liquid-glass panel (SDK 57 expo-glass-effect). Renders Apple's real glass
// material where the OS supports it (iOS 26+); everywhere else it falls back to
// a plain View with the provided `fallbackStyle`, so callers get a graceful,
// no-regression result. Purely additive — safe to adopt for premium surfaces.
const supported = isLiquidGlassAvailable();

export function GlassPanel({
  children,
  style,
  fallbackStyle,
  tintColor,
  ...rest
}: ViewProps & { fallbackStyle?: ViewStyle; tintColor?: string }) {
  if (supported) {
    return (
      <GlassView style={style} tintColor={tintColor} glassEffectStyle="regular" {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[fallbackStyle, style]} {...rest}>
      {children}
    </View>
  );
}

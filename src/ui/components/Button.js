import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, View } from 'react-native';
import { gradients, palette, radii, shadows } from '../theme';
import { haptics } from '@/src/core/haptics';

/**
 * Variants: 'primary' | 'secondary' | 'ghost' | 'danger'
 * Sizes: 'lg' (52) | 'md' (44) | 'sm' (36)
 * `loading` shows a spinner and blocks the press (replaces hand-rolled
 * ActivityIndicators). Primary renders the brand gradient for depth.
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
}) {
  const v = styles[variant] || styles.primary;
  const vt = textStyles[variant] || textStyles.primary;
  const s = sizes[size] || sizes.md;
  const isPrimary = variant === 'primary';
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      onPressIn={() => {
        if (!blocked) haptics.impact(variant === 'danger' ? 'medium' : 'light');
      }}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      style={({ pressed }) => [
        styles.base, v, s.box,
        isPrimary && shadows.glowAccent,
        pressed && !blocked && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.brand}
          locations={gradients.brandLocations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={vt.color} />
      ) : (
        <>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text style={[styles.label, vt, { fontSize: s.font }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const sizes = {
  lg: { box: { height: 52, paddingHorizontal: 24 }, font: 17 },
  md: { box: { height: 44, paddingHorizontal: 20 }, font: 15 },
  sm: { box: { height: 36, paddingHorizontal: 14 }, font: 13 },
};

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radii.control, overflow: 'hidden' },
  label: { fontWeight: '700', letterSpacing: 0.2 },
  primary: { backgroundColor: palette.accent },
  secondary: { backgroundColor: 'rgba(59,158,240,0.10)', borderWidth: 1, borderColor: palette.lineStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: palette.bad },
});

const textStyles = StyleSheet.create({
  primary: { color: '#04101F' },
  secondary: { color: palette.bright },
  ghost: { color: palette.bright },
  danger: { color: '#FFF' },
});

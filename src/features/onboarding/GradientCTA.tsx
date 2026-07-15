import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { shadows } from '@/src/ui';
import type { IoniconName } from './content';

/**
 * Full-width gradient CTA — port of the iOS onboarding primary button:
 * #5AB0FF → #2E82F0 → #1A68DC diagonal fill, 16pt continuous corners, bold
 * white label + trailing glyph, and an accent glow shadow.
 */
export function GradientCTA({
  title,
  icon,
  onPress,
  style,
}: {
  title: string;
  icon?: IoniconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.wrap,
        shadows.glowAccent,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={['#5AB0FF', '#2E82F0', '#1A68DC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <Text style={styles.label}>{title}</Text>
        {icon ? <Ionicons name={icon} size={15} color="#FFFFFF" /> : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
  },
  fill: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

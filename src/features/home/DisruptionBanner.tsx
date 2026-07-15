import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radii, spacing, type } from '@/src/ui';
import type { DisruptionEvent, DisruptionKind } from '@/src/core/api/disruptions';

// Accent-bordered alert card shown when a recent disruption event is unread.
// Taps through to the Trip Disruption dashboard.

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND_ICON: Record<DisruptionKind, IoniconName> = {
  DELAY: 'time',
  GATE_CHANGE: 'swap-horizontal',
  CANCELLED: 'close-circle',
  DIVERTED: 'shuffle',
};

export function DisruptionBanner({ event }: { event: DisruptionEvent }) {
  const router = useRouter();
  const severe = event.kind === 'CANCELLED' || event.kind === 'DIVERTED';
  const tint = severe ? palette.bad : palette.warn;
  const fill = severe ? palette.fillBad : palette.fillWarn;
  const border = severe ? 'rgba(255,92,92,0.45)' : 'rgba(232,160,32,0.45)';

  return (
    <Pressable
      onPress={() => router.push('/disruption')}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: fill, borderColor: border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: severe ? 'rgba(255,92,92,0.15)' : 'rgba(232,160,32,0.15)' }]}>
        <Ionicons name={KIND_ICON[event.kind] ?? 'warning'} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.overline, { color: tint, marginBottom: 2 }]}>Disruption</Text>
        <Text style={type.sub} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={2}>
          {event.message}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

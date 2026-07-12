import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { palette, spacing, type } from '@/src/ui';

export function BackHeader({
  title,
  overline,
  right,
}: {
  title: string;
  overline?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={palette.bright} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {overline ? (
          <Text style={[type.overline, { color: palette.bright, marginBottom: 4 }]}>{overline}</Text>
        ) : null}
        <Text style={type.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { palette, spacing, type } from '@/src/ui';

export function ModalHeader({
  title,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
}: {
  title: string;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
}) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 64 }}>
        <Text style={[type.body, { color: palette.bright }]}>Cancel</Text>
      </Pressable>
      <Text style={[type.sub, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        onPress={onSave}
        disabled={saveDisabled}
        hitSlop={10}
        style={{ width: 64, alignItems: 'flex-end' }}
      >
        <Text
          style={[type.body, { color: saveDisabled ? palette.faint : palette.bright, fontWeight: '700' }]}
        >
          {saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

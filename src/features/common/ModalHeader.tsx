import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { PressableScale, palette, spacing, type } from '@/src/ui';

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
      <PressableScale
        onPress={() => router.back()}
        hitSlop={10}
        haptic="light"
        style={{ width: 64 }}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={[type.body, { color: palette.bright }]}>Cancel</Text>
      </PressableScale>
      <Text style={[type.sub, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {title}
      </Text>
      <PressableScale
        onPress={onSave}
        disabled={saveDisabled}
        hitSlop={10}
        haptic="success"
        style={{ width: 64, alignItems: 'flex-end' }}
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        accessibilityState={{ disabled: !!saveDisabled }}
      >
        <Text
          style={[type.body, { color: saveDisabled ? palette.faint : palette.bright, fontWeight: '700' }]}
        >
          {saveLabel}
        </Text>
      </PressableScale>
    </View>
  );
}

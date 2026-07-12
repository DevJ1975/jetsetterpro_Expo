import React from 'react';
import { Text, View } from 'react-native';
import { Button, spacing, type } from '@/src/ui';
import { IconWell } from './IconWell';

export function EmptyState({
  icon = 'sparkles',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
      <IconWell name={icon} size={24} style={{ width: 56, height: 56, borderRadius: 18 }} />
      <Text style={[type.sub, { textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.bodyDim, { textAlign: 'center', maxWidth: 280 }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} size="md" onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

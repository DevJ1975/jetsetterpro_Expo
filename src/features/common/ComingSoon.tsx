import React from 'react';
import { Text, View } from 'react-native';
import { Badge, spacing, type } from '@/src/ui';
import { IconWell } from './IconWell';

/** Branded placeholder for features not yet ported (More rows + IRIS tab). */
export function ComingSoon({
  title,
  subtitle,
  icon = 'sparkles',
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: spacing.md }}>
      <IconWell name={icon} size={26} style={{ width: 64, height: 64, borderRadius: 20 }} />
      <Text style={[type.heading, { textAlign: 'center', marginTop: spacing.md }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.bodyDim, { textAlign: 'center', maxWidth: 300 }]}>{subtitle}</Text>
      ) : null}
      <Badge tone="accent" label="Coming soon" style={{ marginTop: spacing.sm }} />
    </View>
  );
}

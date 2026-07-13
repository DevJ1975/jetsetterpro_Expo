import React from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, SectionLabel, spacing, type } from '@/src/ui';
import { useIsPro } from '@/src/core/store/subscription';
import { IconWell } from './IconWell';

/** Wraps a premium feature. Pro is unlocked for the beta (see subscription
 *  store); real IAP gating arrives with the subscription/paywall phase. */
export function PremiumGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;

  return (
    <View style={{ padding: spacing.xl }}>
      <Card variant="glass">
        <SectionLabel>JetSetter Pro</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconWell name="lock-closed" />
          <View style={{ flex: 1 }}>
            <Text style={type.sub}>{feature}</Text>
            <Text style={[type.bodyDim, { marginTop: 2 }]}>Included with JetSetter Pro.</Text>
          </View>
          <Badge tone="accent" label="Pro" />
        </View>
      </Card>
    </View>
  );
}

import Constants from 'expo-constants';
import React from 'react';
import { Text, View } from 'react-native';
import { Card, SectionLabel, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { IconWell } from '@/src/features/common/IconWell';

const HIGHLIGHTS: { icon: string; title: string; body: string }[] = [
  { icon: 'sparkles', title: 'IRIS travel agent', body: 'An AI that knows your itinerary and can act on it.' },
  { icon: 'airplane', title: 'Flights & disruptions', body: 'Tracking, rebooking, and leave-by timing.' },
  { icon: 'briefcase', title: 'Trip tools', body: 'Packing, wallet, documents, loyalty, and more.' },
  { icon: 'lock-closed', title: 'Private by design', body: 'Your data stays on-device; sync is yours to control.' },
];

export default function AboutScreen() {
  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader overline="For the frequent traveler" title="About JetSetter Pro" />

      <Card variant="glass" style={{ gap: spacing.md }}>
        <Text style={type.body}>
          JetSetter Pro is your travel co-pilot — one place for your itinerary, expenses, documents,
          and an AI agent that actually operates the app for you.
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <SectionLabel>What&apos;s inside</SectionLabel>
        {HIGHLIGHTS.map((h) => (
          <View key={h.title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconWell name={h.icon} />
            <View style={{ flex: 1 }}>
              <Text style={type.sub}>{h.title}</Text>
              <Text style={[type.bodyDim, { marginTop: 2 }]}>{h.body}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
        JetSetter Pro · v{Constants.expoConfig?.version ?? '1.0.0'} · Made for travelers
      </Text>
    </Screen>
  );
}
